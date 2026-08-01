import { describe, expect, test, vi } from "vitest";
import { QueryError, queryAnalytics } from "./query";

const env = { CF_ACCOUNT_ID: "acc-1", CF_API_TOKEN: "token-1" };

describe("queryAnalytics", () => {
	test("POSTs the sql to the account endpoint with a bearer token", async () => {
		const fetchFn = vi.fn<typeof fetch>(async () => {
			return new Response(JSON.stringify({ data: [], rows: 0 }), {
				status: 200,
			});
		});

		const result = await queryAnalytics(env, "SELECT 1", fetchFn);

		expect(fetchFn).toHaveBeenCalledOnce();
		const [url, init] = fetchFn.mock.calls[0] ?? [];
		expect(String(url)).toBe(
			"https://api.cloudflare.com/client/v4/accounts/acc-1/analytics_engine/sql",
		);
		expect((init as RequestInit).method).toBe("POST");
		expect((init as RequestInit).body).toBe("SELECT 1");
		expect((init as RequestInit).headers).toEqual({
			Authorization: "Bearer token-1",
		});
		expect(result).toEqual({ data: [], rows: 0 });
	});

	test("parses the response rows", async () => {
		const fetchFn = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					data: [{ t: "2026-08-01", pageviews: 10 }],
					rows: 1,
				}),
				{ status: 200 },
			);
		});

		const result = await queryAnalytics(env, "SELECT ...", fetchFn);

		expect(result.data).toEqual([{ t: "2026-08-01", pageviews: 10 }]);
		expect(result.rows).toBe(1);
	});

	test("throws a QueryError on a non-2xx response", async () => {
		const fetchFn = vi.fn(async () => {
			return new Response("bad query", { status: 400 });
		});

		await expect(queryAnalytics(env, "SELECT bad", fetchFn)).rejects.toThrow(
			QueryError,
		);
	});
});
