import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	fetchBreakdowns,
	fetchOverview,
	fetchRealtime,
	login,
	logout,
} from "@/lib/api";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

describe("api client", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => jsonResponse({ error: "not found" }, 404)),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("login resolves on an empty 200 body (Set-Cookie only)", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(null, { status: 200 })),
		);

		await expect(login("secret")).resolves.toBeUndefined();
	});

	it("logout resolves on an empty 200 body", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(null, { status: 200 })),
		);

		await expect(logout()).resolves.toBeUndefined();
	});

	it("login rejects with the server error message on a 401", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => jsonResponse({ error: "unauthorized" }, 401)),
		);

		await expect(login("wrong")).rejects.toMatchObject({
			status: 401,
			message: "unauthorized",
		});
	});

	it("fetchOverview parses pageviews and uniques", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes("/api/pageviews")) {
					return jsonResponse({ series: [{ t: 1, pageviews: 5 }], total: 5 });
				}
				return jsonResponse({ uniques: 2 });
			}),
		);

		const result = await fetchOverview("site-1", 0, 1000);
		expect(result).toEqual({
			series: [{ t: 1, pageviews: 5 }],
			pageviews: 5,
			uniques: 2,
		});
	});

	it("fetchBreakdowns parses the breakdown response", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse({
					pages: [{ name: "/", pageviews: 10 }],
					referrers: [{ name: "example.com", pageviews: 4 }],
					browsers: [{ name: "Chrome", pageviews: 9 }],
					oses: [{ name: "Linux", pageviews: 8 }],
					devices: [{ name: "desktop", pageviews: 7 }],
					countries: [{ name: "US", pageviews: 6 }],
					bounce: { bounces: 2, visitors: 5, rate: 0.4 },
				}),
			),
		);

		const result = await fetchBreakdowns("site-1", 0, 1000);
		expect(result.bounce).toEqual({ bounces: 2, visitors: 5, rate: 0.4 });
		expect(result.pages).toEqual([{ name: "/", pageviews: 10 }]);
	});

	it("fetchRealtime parses the realtime response", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse({ windowMs: 300000, uniques: 3, pageviews: 7 }),
			),
		);

		const result = await fetchRealtime("site-1");
		expect(result).toEqual({ windowMs: 300000, uniques: 3, pageviews: 7 });
	});
});
