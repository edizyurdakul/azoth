import { describe, expect, test } from "vitest";
import { isAuthorized } from "./auth";

const env = { AUTH_SECRET: "super-secret" };

describe("isAuthorized", () => {
	test("accepts the correct bearer token", () => {
		const request = new Request("https://dash.example.com/api/pageviews", {
			headers: { Authorization: "Bearer super-secret" },
		});
		expect(isAuthorized(request, env)).toBe(true);
	});

	test("rejects a wrong token", () => {
		const request = new Request("https://dash.example.com/api/pageviews", {
			headers: { Authorization: "Bearer nope" },
		});
		expect(isAuthorized(request, env)).toBe(false);
	});

	test("rejects a missing header", () => {
		const request = new Request("https://dash.example.com/api/pageviews");
		expect(isAuthorized(request, env)).toBe(false);
	});
});
