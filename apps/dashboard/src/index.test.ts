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
});
