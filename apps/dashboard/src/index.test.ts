// @azoth/dashboard tests run under Vitest with @cloudflare/vitest-pool-workers
// (workerd semantics, not Bun's default runner) — see apps/dashboard/vitest.config.ts.
import { beforeEach, describe, expect, test, vi } from "vitest";
import worker from "./index";
import { makeMockKV } from "./test/kv";

const AUTH = { Authorization: "Bearer super-secret" };
const testEnv: Cloudflare.Env = {
	CF_ACCOUNT_ID: "acc-1",
	CF_API_TOKEN: "token-1",
	AUTH_SECRET: "super-secret",
	SITES: makeMockKV(),
	INGESTION_URL: "https://ingestion.edizyurdakul.workers.dev",
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
				"https://dashboard.edizyurdakul.workers.dev/api/pageviews?siteId=site-1&from=1000&to=2000",
			),
			testEnv,
		);

		expect(response.status).toBe(401);
	});

	test("returns pageviews series for an authorized request", async () => {
		stubQuery([{ t: "2026-08-01", pageviews: 10 }]);

		const response = await worker.fetch(
			new Request(
				"https://dashboard.edizyurdakul.workers.dev/api/pageviews?siteId=site-1&from=1000&to=2000",
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
				"https://dashboard.edizyurdakul.workers.dev/api/uniques?siteId=site-1&from=1000&to=2000",
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
				"https://dashboard.edizyurdakul.workers.dev/api/breakdown?siteId=site-1&from=1000&to=2000",
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
				"https://dashboard.edizyurdakul.workers.dev/api/breakdown?siteId=site-1&from=1000&to=2000",
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
				new Request(
					"https://dashboard.edizyurdakul.workers.dev/api/realtime?siteId=site-1",
					{
						headers: AUTH,
					},
				),
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

	test("returns account-level AE usage without a siteId", async () => {
		stubQueriesByBody((sql) => {
			if (sql.includes("GROUP BY t")) {
				return [{ t: "2026-08-01", events: 3 }];
			}
			return [{ events: 5 }];
		});

		const response = await worker.fetch(
			new Request(
				"https://dashboard.edizyurdakul.workers.dev/api/usage?from=1000&to=2000",
				{ headers: AUTH },
			),
			testEnv,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			total: 5,
			series: [{ t: "2026-08-01", events: 3 }],
		});
	});

	test("rejects usage without a valid time range", async () => {
		const response = await worker.fetch(
			new Request(
				"https://dashboard.edizyurdakul.workers.dev/api/usage?from=2000&to=1000",
				{ headers: AUTH },
			),
			testEnv,
		);

		expect(response.status).toBe(400);
	});

	test("rejects a malformed siteId with 400", async () => {
		const response = await worker.fetch(
			new Request(
				"https://dashboard.edizyurdakul.workers.dev/api/pageviews?siteId=bad%20id&from=1000&to=2000",
				{ headers: AUTH },
			),
			testEnv,
		);

		expect(response.status).toBe(400);
	});

	test("rejects an invalid time range with 400", async () => {
		const response = await worker.fetch(
			new Request(
				"https://dashboard.edizyurdakul.workers.dev/api/pageviews?siteId=site-1&from=2000&to=1000",
				{ headers: AUTH },
			),
			testEnv,
		);

		expect(response.status).toBe(400);
	});

	test("rejects an invalid bucket with 400", async () => {
		const response = await worker.fetch(
			new Request(
				"https://dashboard.edizyurdakul.workers.dev/api/pageviews?siteId=site-1&from=1000&to=2000&bucket=week",
				{ headers: AUTH },
			),
			testEnv,
		);

		expect(response.status).toBe(400);
	});

	test("returns 404 for unknown paths", async () => {
		const response = await worker.fetch(
			new Request(
				"https://dashboard.edizyurdakul.workers.dev/nope?siteId=site-1&from=1000&to=2000",
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
				"https://dashboard.edizyurdakul.workers.dev/api/uniques?siteId=site-1&from=1000&to=2000",
				{ headers: AUTH },
			),
			testEnv,
		);

		expect(response.status).toBe(500);
	});

	test("no longer serves the UI at / (served by Wrangler Assets)", async () => {
		const response = await worker.fetch(
			new Request("https://dashboard.edizyurdakul.workers.dev/"),
			testEnv,
		);

		expect(response.status).toBe(401);
	});

	test("login with correct secret sets the auth cookie", async () => {
		const response = await worker.fetch(
			new Request("https://dashboard.edizyurdakul.workers.dev/api/login", {
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
			new Request("https://dashboard.edizyurdakul.workers.dev/api/login", {
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
			new Request("https://dashboard.edizyurdakul.workers.dev/api/login", {
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
			new Request("https://dashboard.edizyurdakul.workers.dev/api/logout", {
				method: "POST",
			}),
			testEnv,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
	});

	test("accepts a valid auth cookie on an API route", async () => {
		stubQuery([{ uniques: 4 }]);

		const response = await worker.fetch(
			new Request(
				"https://dashboard.edizyurdakul.workers.dev/api/uniques?siteId=site-1&from=1000&to=2000",
				{ headers: { Cookie: "azoth_auth=super-secret" } },
			),
			testEnv,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ uniques: 4 });
	});

	test("lists sites for an authorized request", async () => {
		const siteId = "site-1";
		const kv = makeMockKV({
			"site:site-1": JSON.stringify({
				siteId,
				name: "My Site",
				createdAt: "2026-08-01T00:00:00.000Z",
			}),
		});
		const env = { ...testEnv, SITES: kv };

		const response = await worker.fetch(
			new Request("https://dashboard.edizyurdakul.workers.dev/api/sites", {
				headers: AUTH,
			}),
			env,
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			sites: Array<{ siteId: string; name: string; snippet: string }>;
		};
		expect(body.sites).toHaveLength(1);
		expect(body.sites[0]).toEqual({
			siteId,
			name: "My Site",
			createdAt: "2026-08-01T00:00:00.000Z",
			snippet:
				'<script defer src="https://ingestion.edizyurdakul.workers.dev/tracker.min.js" data-site-id="site-1"></script>',
		});
	});

	test("creates a site and returns its snippet", async () => {
		const env = { ...testEnv, SITES: makeMockKV() };
		const response = await worker.fetch(
			new Request("https://dashboard.edizyurdakul.workers.dev/api/sites", {
				method: "POST",
				headers: { ...AUTH, "Content-Type": "application/json" },
				body: JSON.stringify({ name: "New Site" }),
			}),
			env,
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			site: { siteId: string; name: string };
			snippet: string;
		};
		expect(body.site.name).toBe("New Site");
		expect(body.site.siteId).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
		expect(body.snippet).toContain(body.site.siteId);
	});

	test("rejects creating a site without a name", async () => {
		const response = await worker.fetch(
			new Request("https://dashboard.edizyurdakul.workers.dev/api/sites", {
				method: "POST",
				headers: { ...AUTH, "Content-Type": "application/json" },
				body: JSON.stringify({}),
			}),
			testEnv,
		);

		expect(response.status).toBe(400);
	});

	test("deletes a site", async () => {
		const siteId = "site-1";
		const kv = makeMockKV({
			"site:site-1": JSON.stringify({
				siteId,
				name: "My Site",
				createdAt: "2026-08-01T00:00:00.000Z",
			}),
		});
		const env = { ...testEnv, SITES: kv };

		const response = await worker.fetch(
			new Request(
				`https://dashboard.edizyurdakul.workers.dev/api/sites?siteId=${siteId}`,
				{
					method: "DELETE",
					headers: AUTH,
				},
			),
			env,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
		expect(kv.store.has("site:site-1")).toBe(false);
	});

	test("returns 404 when deleting an unknown site", async () => {
		const response = await worker.fetch(
			new Request(
				"https://dashboard.edizyurdakul.workers.dev/api/sites?siteId=nope",
				{
					method: "DELETE",
					headers: AUTH,
				},
			),
			testEnv,
		);

		expect(response.status).toBe(404);
	});

	test("requires auth for site management", async () => {
		const response = await worker.fetch(
			new Request("https://dashboard.edizyurdakul.workers.dev/api/sites"),
			testEnv,
		);
		expect(response.status).toBe(401);
	});
});
