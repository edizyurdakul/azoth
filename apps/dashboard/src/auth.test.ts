import { describe, expect, test } from "vitest";
import { authCookie, clearAuthCookie, isAuthorized } from "./auth";

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

	test("accepts the correct auth cookie", () => {
		const request = new Request("https://dash.example.com/api/pageviews", {
			headers: { Cookie: `azoth_auth=${env.AUTH_SECRET}` },
		});
		expect(isAuthorized(request, env)).toBe(true);
	});

	test("accepts cookie among other cookies", () => {
		const request = new Request("https://dash.example.com/api/pageviews", {
			headers: { Cookie: `theme=dark; azoth_auth=${env.AUTH_SECRET}` },
		});
		expect(isAuthorized(request, env)).toBe(true);
	});

	test("rejects a wrong cookie", () => {
		const request = new Request("https://dash.example.com/api/pageviews", {
			headers: { Cookie: `azoth_auth=nope` },
		});
		expect(isAuthorized(request, env)).toBe(false);
	});

	test("rejects an unrelated cookie", () => {
		const request = new Request("https://dash.example.com/api/pageviews", {
			headers: { Cookie: `theme=dark` },
		});
		expect(isAuthorized(request, env)).toBe(false);
	});
});

describe("authCookie", () => {
	test("sets HttpOnly SameSite Lax and a month-long expiry", () => {
		const cookie = authCookie(env.AUTH_SECRET);
		expect(cookie).toContain(`azoth_auth=${env.AUTH_SECRET}`);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
		expect(cookie).toContain("Path=/");
		expect(cookie).toContain("Max-Age=2592000");
	});
});

describe("clearAuthCookie", () => {
	test("expires the cookie immediately", () => {
		const cookie = clearAuthCookie();
		expect(cookie).toContain("azoth_auth=");
		expect(cookie).toContain("Max-Age=0");
	});
});
