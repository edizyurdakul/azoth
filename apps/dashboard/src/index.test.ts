// @azoth/dashboard tests run under Vitest with @cloudflare/vitest-pool-workers
// (workerd semantics, not Bun's default runner) — see apps/dashboard/vitest.config.ts.
import { beforeEach, describe, expect, test, vi } from "vitest";
import worker from "./index";

const AUTH = { Authorization: "Bearer super-secret" };
const testEnv: Cloudflare.Env = {
	CF_ACCOUNT_ID: "acc-1",
	CF_API_TOKEN: "token-1",
	AUTH_SECRET: "super-secret",
};

function stubQuery(data: unknown[], rows = data.length) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => {
			return new Response(JSON.stringify({ data, rows }), { status: 200 });
		}),
	);
}

function stubQueriesByBody(respond: (sql: string) => unknown[]) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
			const sql = String(init?.body ?? "");
			return new Response(JSON.stringify({ data: respond(sql), rows: 0 }), {
				status: 200,
			});
		}),
	);
}

describe("dashboard worker", () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	test("requires authorization", async () => {
		const response = await worker.fetch(
			new Request(
				"https://dash.example.com/api/pageviews?siteId=site-1&from=1000&to=2000",
			),
			testEnv,
		);

		expect(response.status).toBe(401);
	});

	test("returns pageviews series for an authorized request", async () => {
		stubQuery([{ t: "2026-08-01", pageviews: 10 }]);

		const response = await worker.fetch(
			new Request(
				"https://dash.example.com/api/pageviews?siteId=site-1&from=1000&to=2000",
				{ headers: AUTH },
			),
			testEnv,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			series: [{ t: "2026-08-01", pageviews: 10 }],
			total: 10,
		});
	});

	test("returns uniques for an authorized request", async () => {
		stubQuery([{ uniques: 4 }]);

		const response = await worker.fetch(
			new Request(
				"https://dash.example.com/api/uniques?siteId=site-1&from=1000&to=2000",
				{ headers: AUTH },
			),
			testEnv,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ uniques: 4 });
	});

	test("returns breakdown data for an authorized request", async () => {
		stubQueriesByBody((sql) => {
			if (sql.includes("countIf(cnt = 1)")) {
				return [{ bounces: 2, visitors: 5 }];
			}
			return [{ name: "/", pageviews: 10 }];
		});

		const response = await worker.fetch(
			new Request(
				"https://dash.example.com/api/breakdown?siteId=site-1&from=1000&to=2000",
				{ headers: AUTH },
			),
			testEnv,
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			pages: Array<{ name: string; pageviews: number }>;
			browsers: Array<{ name: string; pageviews: number }>;
			referrers: Array<{ name: string; pageviews: number }>;
			bounce: { bounces: number; visitors: number; rate: number };
		};
		expect(body.pages).toEqual([{ name: "/", pageviews: 10 }]);
		expect(body.browsers).toEqual([{ name: "/", pageviews: 10 }]);
		expect(body.referrers).toEqual([{ name: "/", pageviews: 10 }]);
		expect(body.bounce).toEqual({ bounces: 2, visitors: 5, rate: 0.4 });
	});

	test("returns a zero bounce rate when there are no visitors", async () => {
		stubQueriesByBody(() => [{ bounces: 0, visitors: 0 }]);

		const response = await worker.fetch(
			new Request(
				"https://dash.example.com/api/breakdown?siteId=site-1&from=1000&to=2000",
				{ headers: AUTH },
			),
			testEnv,
		);

		const body = (await response.json()) as {
			bounce: { bounces: number; visitors: number; rate: number };
		};
		expect(body.bounce).toEqual({ bounces: 0, visitors: 0, rate: 0 });
	});

	test("returns realtime stats over a 5-minute window", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-01T12:00:00Z"));
		stubQueriesByBody((sql) => {
			if (sql.includes("COUNT(DISTINCT")) {
				return [{ uniques: 3 }];
			}
			return [{ pageviews: 7 }];
		});

		try {
			const response = await worker.fetch(
				new Request("https://dash.example.com/api/realtime?siteId=site-1", {
					headers: AUTH,
				}),
				testEnv,
			);

			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({
				windowMs: 300000,
				uniques: 3,
				pageviews: 7,
			});
		} finally {
			vi.useRealTimers();
		}
	});

	test("rejects a malformed siteId with 400", async () => {
		const response = await worker.fetch(
			new Request(
				"https://dash.example.com/api/pageviews?siteId=bad%20id&from=1000&to=2000",
				{ headers: AUTH },
			),
			testEnv,
		);

		expect(response.status).toBe(400);
	});

	test("rejects an invalid time range with 400", async () => {
		const response = await worker.fetch(
			new Request(
				"https://dash.example.com/api/pageviews?siteId=site-1&from=2000&to=1000",
				{ headers: AUTH },
			),
			testEnv,
		);

		expect(response.status).toBe(400);
	});

	test("rejects an invalid bucket with 400", async () => {
		const response = await worker.fetch(
			new Request(
				"https://dash.example.com/api/pageviews?siteId=site-1&from=1000&to=2000&bucket=week",
				{ headers: AUTH },
			),
			testEnv,
		);

		expect(response.status).toBe(400);
	});

	test("returns 404 for unknown paths", async () => {
		const response = await worker.fetch(
			new Request(
				"https://dash.example.com/nope?siteId=site-1&from=1000&to=2000",
				{ headers: AUTH },
			),
			testEnv,
		);

		expect(response.status).toBe(404);
	});

	test("returns 500 when the AE query fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				return new Response("boom", { status: 400 });
			}),
		);

		const response = await worker.fetch(
			new Request(
				"https://dash.example.com/api/uniques?siteId=site-1&from=1000&to=2000",
				{ headers: AUTH },
			),
			testEnv,
		);

		expect(response.status).toBe(500);
	});

	test("no longer serves the UI at / (served by Wrangler Assets)", async () => {
		const response = await worker.fetch(
			new Request("https://dash.example.com/"),
			testEnv,
		);

		expect(response.status).toBe(401);
	});

	test("login with correct secret sets the auth cookie", async () => {
		const response = await worker.fetch(
			new Request("https://dash.example.com/api/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ secret: "super-secret" }),
			}),
			testEnv,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("set-cookie")).toContain(
			"azoth_auth=super-secret",
		);
	});

	test("login with wrong secret returns 401 and no cookie", async () => {
		const response = await worker.fetch(
			new Request("https://dash.example.com/api/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ secret: "nope" }),
			}),
			testEnv,
		);

		expect(response.status).toBe(401);
		expect(response.headers.get("set-cookie")).toBeNull();
	});

	test("login with missing secret returns 400", async () => {
		const response = await worker.fetch(
			new Request("https://dash.example.com/api/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			}),
			testEnv,
		);

		expect(response.status).toBe(400);
	});

	test("logout clears the auth cookie", async () => {
		const response = await worker.fetch(
			new Request("https://dash.example.com/api/logout", { method: "POST" }),
			testEnv,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
	});

	test("accepts a valid auth cookie on an API route", async () => {
		stubQuery([{ uniques: 4 }]);

		const response = await worker.fetch(
			new Request(
				"https://dash.example.com/api/uniques?siteId=site-1&from=1000&to=2000",
				{ headers: { Cookie: "azoth_auth=super-secret" } },
			),
			testEnv,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ uniques: 4 });
	});
});
