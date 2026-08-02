// @azoth/ingestion tests run under Vitest with @cloudflare/vitest-pool-workers
// (workerd semantics, not Bun's default runner) — see apps/ingestion/vitest.config.ts.
import { BLOB_FIELDS, DOUBLE_FIELDS, toWriteDataPoint } from "@azoth/schema";
import { beforeEach, describe, expect, test } from "vitest";
import worker, {
	buildPageview,
	dateSalt,
	hashVisitor,
	isValidPath,
	isValidSiteId,
	reduceReferrer,
} from "./index";

const UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

describe("isValidSiteId", () => {
	test("accepts well-formed ids", () => {
		expect(isValidSiteId("site-1")).toBe(true);
		expect(isValidSiteId("aB_9-xZ")).toBe(true);
	});

	test("rejects missing and malformed ids", () => {
		expect(isValidSiteId(null)).toBe(false);
		expect(isValidSiteId("")).toBe(false);
		expect(isValidSiteId("has spaces")).toBe(false);
		expect(isValidSiteId("bad/id")).toBe(false);
		expect(isValidSiteId("x".repeat(65))).toBe(false);
	});
});

describe("reduceReferrer", () => {
	test("reduces a full url to its hostname", () => {
		expect(reduceReferrer("https://example.com/blog/post?utm=x")).toBe(
			"example.com",
		);
	});

	test("returns empty string for empty or malformed input", () => {
		expect(reduceReferrer("")).toBe("");
		expect(reduceReferrer("not a url")).toBe("");
	});
});

describe("isValidPath", () => {
	test("accepts normal paths and the default", () => {
		expect(isValidPath("/")).toBe(true);
		expect(isValidPath("/blog/hello")).toBe(true);
	});

	test("rejects paths over 16 KiB in UTF-8 bytes", () => {
		expect(isValidPath("/".repeat(16 * 1024))).toBe(true);
		expect(isValidPath("x".repeat(16 * 1024 + 1))).toBe(false);
		expect(isValidPath("é".repeat(16 * 1024))).toBe(false);
	});
});

describe("dateSalt", () => {
	test("is the UTC calendar date", () => {
		expect(dateSalt(new Date("2026-08-01T23:59:59.999Z"))).toBe("2026-08-01");
		expect(dateSalt(new Date("2026-08-01T00:00:00.000Z"))).toBe("2026-08-01");
	});
});

describe("hashVisitor", () => {
	test("produces a deterministic 64-char hex hash", async () => {
		const a = await hashVisitor("203.0.113.7", UA, "site-1", "2026-08-01");
		const b = await hashVisitor("203.0.113.7", UA, "site-1", "2026-08-01");
		expect(a).toMatch(/^[0-9a-f]{64}$/);
		expect(a).toBe(b);
	});

	test("changes when the daily salt changes", async () => {
		const a = await hashVisitor("203.0.113.7", UA, "site-1", "2026-08-01");
		const b = await hashVisitor("203.0.113.7", UA, "site-1", "2026-08-02");
		expect(a).not.toBe(b);
	});
});

describe("buildPageview", () => {
	test("assembles an event matching the schema write shape", async () => {
		const request = new Request(
			"https://ingest.example.com/collect?siteId=site-1&path=%2Fblog%2Fhello&referrer=https%3A%2F%2Fexample.com%2Fpost",
			{
				method: "POST",
				headers: { "user-agent": UA, "cf-connecting-ip": "203.0.113.7" },
			},
		);
		const event = await buildPageview(request, {
			now: () => 1_700_000_000_000,
			salt: "2026-08-01",
		});

		expect(event).not.toBeNull();
		if (event === null) {
			throw new Error("expected a pageview event");
		}

		const dp = toWriteDataPoint(event);
		expect(dp.indexes).toEqual(["site-1"]);
		expect([...dp.blobs]).toEqual(BLOB_FIELDS.map((field) => event[field]));
		expect([...dp.doubles]).toEqual(DOUBLE_FIELDS.map((field) => event[field]));

		expect(event.path).toBe("/blog/hello");
		expect(event.referrer).toBe("example.com");
		expect(event.browser).toBe("Chrome");
		expect(event.visitorHash).toBe(
			await hashVisitor("203.0.113.7", UA, "site-1", "2026-08-01"),
		);
	});

	test("returns null for a missing siteId", async () => {
		const request = new Request("https://ingest.example.com/collect", {
			method: "POST",
		});
		expect(
			await buildPageview(request, { now: Date.now, salt: "2026-08-01" }),
		).toBeNull();
	});

	test("returns null for a malformed siteId", async () => {
		const request = new Request(
			"https://ingest.example.com/collect?siteId=bad%20id",
			{
				method: "POST",
			},
		);
		expect(
			await buildPageview(request, { now: Date.now, salt: "2026-08-01" }),
		).toBeNull();
	});
});

describe("worker endpoint", () => {
	const written: AnalyticsEngineDataPoint[] = [];
	let rateLimitOutcome = { success: true };
	const rateLimitKeys: string[] = [];
	const testEnv: Cloudflare.Env = {
		ANALYTICS: {
			writeDataPoint: (data?: AnalyticsEngineDataPoint) => {
				if (data) {
					written.push(data);
				}
			},
		},
		RATE_LIMITER: {
			limit: async (options) => {
				rateLimitKeys.push(options.key);
				return rateLimitOutcome;
			},
		},
	};

	beforeEach(() => {
		written.length = 0;
		rateLimitKeys.length = 0;
		rateLimitOutcome = { success: true };
	});

	test("collects a valid pageview and returns a CORS-enabled 200", async () => {
		const response = await worker.fetch(
			new Request("https://ingest.example.com/collect?siteId=site-1", {
				method: "POST",
				headers: { "user-agent": UA },
			}),
			testEnv,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
		expect(written).toHaveLength(1);
		expect(written[0]?.indexes).toEqual(["site-1"]);
	});

	test("keys the rate limit by client IP and siteId", async () => {
		const response = await worker.fetch(
			new Request("https://ingest.example.com/collect?siteId=site-1", {
				method: "POST",
				headers: { "user-agent": UA, "cf-connecting-ip": "203.0.113.7" },
			}),
			testEnv,
		);

		expect(response.status).toBe(200);
		expect(rateLimitKeys).toEqual(["203.0.113.7|site-1"]);
	});

	test("returns 429 without writing when the rate limit is exceeded", async () => {
		rateLimitOutcome = { success: false };

		const response = await worker.fetch(
			new Request("https://ingest.example.com/collect?siteId=site-1", {
				method: "POST",
				headers: { "user-agent": UA },
			}),
			testEnv,
		);

		expect(response.status).toBe(429);
		expect(written).toHaveLength(0);
	});

	test("answers an OPTIONS preflight with CORS headers", async () => {
		const response = await worker.fetch(
			new Request("https://ingest.example.com/collect", { method: "OPTIONS" }),
			testEnv,
		);

		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
			"POST",
		);
	});

	test("rejects an invalid siteId with 400", async () => {
		const response = await worker.fetch(
			new Request("https://ingest.example.com/collect", { method: "POST" }),
			testEnv,
		);

		expect(response.status).toBe(400);
	});

	test("rejects an oversized path with 400", async () => {
		const response = await worker.fetch(
			new Request(
				`https://ingest.example.com/collect?siteId=site-1&path=${"x".repeat(16 * 1024 + 1)}`,
				{ method: "POST" },
			),
			testEnv,
		);

		expect(response.status).toBe(400);
		expect(written).toHaveLength(0);
	});

	test("rejects non-POST methods with 405", async () => {
		const response = await worker.fetch(
			new Request("https://ingest.example.com/collect?siteId=site-1", {
				method: "GET",
			}),
			testEnv,
		);

		expect(response.status).toBe(405);
	});

	test("returns 404 for unknown paths", async () => {
		const response = await worker.fetch(
			new Request("https://ingest.example.com/nope?siteId=site-1", {
				method: "POST",
			}),
			testEnv,
		);

		expect(response.status).toBe(404);
	});
});
