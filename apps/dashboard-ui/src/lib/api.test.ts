import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchOverview, login, logout } from "@/lib/api";

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
});
