import { describe, expect, it } from "bun:test";
import { checkHealth, checkUrl } from "./health";

describe("checkUrl", () => {
	it("reports error when the request fails", async () => {
		const check = await checkUrl("x", "http://127.0.0.1:1/nope", 200);
		expect(check.ok).toBe(false);
		expect(check.actual).toBe("error");
	});

	it("reports ok on matching status against a local server", async () => {
		const server = Bun.serve({
			port: 0,
			fetch: () => new Response("ok", { status: 201 }),
		});
		try {
			const url = `http://127.0.0.1:${server.port}/x`;
			const check = await checkUrl("x", url, 201);
			expect(check.ok).toBe(true);
			expect(check.actual).toBe(201);
		} finally {
			server.stop(true);
		}
	});
});

describe("checkHealth", () => {
	it("runs all three endpoint checks", async () => {
		const results = await checkHealth({
			ingestionUrl: "http://127.0.0.1:1",
			dashboardUrl: "http://127.0.0.1:1",
		});
		expect(results).toHaveLength(3);
		expect(results.map((r) => r.name)).toEqual([
			"ingestion /collect",
			"dashboard /api/uniques",
			"tracker.min.js",
		]);
		expect(results.every((r) => !r.ok)).toBe(true);
	});
});
