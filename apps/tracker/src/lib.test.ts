import { describe, expect, test } from "bun:test";
import { buildPageviewUrl } from "./lib";

describe("buildPageviewUrl", () => {
	test("builds /collect URL with siteId and path", () => {
		const url = buildPageviewUrl({
			base: "https://ingestion.example.workers.dev/tracker.min.js",
			siteId: "site-1",
			path: "/blog/hello",
			referrer: "",
		});
		expect(url).toBe(
			"https://ingestion.example.workers.dev/collect?siteId=site-1&path=%2Fblog%2Fhello",
		);
	});

	test("includes referrer when present", () => {
		const url = buildPageviewUrl({
			base: "https://ingestion.example.workers.dev/tracker.min.js",
			siteId: "site-1",
			path: "/",
			referrer: "https://google.com",
		});
		expect(url).toBe(
			"https://ingestion.example.workers.dev/collect?siteId=site-1&path=%2F&referrer=https%3A%2F%2Fgoogle.com",
		);
	});

	test("omits referrer param when empty", () => {
		const url = buildPageviewUrl({
			base: "https://ingestion.example.workers.dev",
			siteId: "a",
			path: "/",
			referrer: "",
		});
		expect(url).not.toContain("referrer");
	});

	test("encodes siteId and path", () => {
		const url = buildPageviewUrl({
			base: "https://ingestion.example.workers.dev",
			siteId: "a b",
			path: "/search?q=1",
			referrer: "",
		});
		expect(url).toBe(
			"https://ingestion.example.workers.dev/collect?siteId=a+b&path=%2Fsearch%3Fq%3D1",
		);
	});
});
