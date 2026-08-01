import { afterEach, describe, expect, test } from "bun:test";
import { buildPageviewUrl, trackPageview } from "./lib";

describe("buildPageviewUrl", () => {
	test("builds /collect URL with siteId and path", () => {
		const url = buildPageviewUrl({
			base: "https://ingestion.edizyurdakul.workers.dev/tracker.min.js",
			siteId: "site-1",
			path: "/blog/hello",
			referrer: "",
		});
		expect(url).toBe(
			"https://ingestion.edizyurdakul.workers.dev/collect?siteId=site-1&path=%2Fblog%2Fhello",
		);
	});

	test("includes referrer when present", () => {
		const url = buildPageviewUrl({
			base: "https://ingestion.edizyurdakul.workers.dev/tracker.min.js",
			siteId: "site-1",
			path: "/",
			referrer: "https://google.com",
		});
		expect(url).toBe(
			"https://ingestion.edizyurdakul.workers.dev/collect?siteId=site-1&path=%2F&referrer=https%3A%2F%2Fgoogle.com",
		);
	});

	test("omits referrer param when empty", () => {
		const url = buildPageviewUrl({
			base: "https://ingestion.edizyurdakul.workers.dev",
			siteId: "a",
			path: "/",
			referrer: "",
		});
		expect(url).not.toContain("referrer");
	});

	test("encodes siteId and path", () => {
		const url = buildPageviewUrl({
			base: "https://ingestion.edizyurdakul.workers.dev",
			siteId: "a b",
			path: "/search?q=1",
			referrer: "",
		});
		expect(url).toBe(
			"https://ingestion.edizyurdakul.workers.dev/collect?siteId=a+b&path=%2Fsearch%3Fq%3D1",
		);
	});

	test("sanitizes referrer to origin only", () => {
		const url = buildPageviewUrl({
			base: "https://ingestion.edizyurdakul.workers.dev",
			siteId: "site-1",
			path: "/",
			referrer: "https://google.com/search?q=azoth&utm_source=x",
		});
		expect(url).toBe(
			"https://ingestion.edizyurdakul.workers.dev/collect?siteId=site-1&path=%2F&referrer=https%3A%2F%2Fgoogle.com",
		);
	});

	test("omits referrer param when it is not a valid URL", () => {
		const url = buildPageviewUrl({
			base: "https://ingestion.edizyurdakul.workers.dev",
			siteId: "site-1",
			path: "/",
			referrer: "not-a-url",
		});
		expect(url).not.toContain("referrer");
	});
});

function stubDom({
	siteId = "site-1",
	endpoint = null,
	pathname = "/",
	search = "",
	referrer = "",
	trackSearch = null,
}: {
	siteId?: string;
	endpoint?: string | null;
	pathname?: string;
	search?: string;
	referrer?: string;
	trackSearch?: string | null;
} = {}) {
	let sent = "";
	const script = {
		src:
			endpoint ?? "https://ingestion.edizyurdakul.workers.dev/tracker.min.js",
		getAttribute(name: string) {
			if (name === "data-site-id") {
				return siteId;
			}
			if (name === "data-endpoint") {
				return endpoint;
			}
			if (name === "data-track-search") {
				return trackSearch;
			}
			return null;
		},
	};
	(globalThis as Record<string, unknown>).document = {
		currentScript: script,
		referrer,
		baseURI: "https://ingestion.edizyurdakul.workers.dev/",
	};
	(globalThis as Record<string, unknown>).location = { pathname, search };
	(globalThis as Record<string, unknown>).navigator = {
		sendBeacon: (url: string) => {
			sent = url;
			return true;
		},
	};
	return { sent: () => sent };
}

afterEach(() => {
	delete (globalThis as Record<string, unknown>).document;
	delete (globalThis as Record<string, unknown>).location;
	delete (globalThis as Record<string, unknown>).navigator;
});

describe("trackPageview", () => {
	test("sends pathname only by default, excluding search", () => {
		const { sent } = stubDom({
			pathname: "/blog/hello",
			search: "?utm_source=x",
			referrer: "https://google.com/search?q=azoth",
		});
		trackPageview();
		expect(sent()).toBe(
			"https://ingestion.edizyurdakul.workers.dev/collect?siteId=site-1&path=%2Fblog%2Fhello&referrer=https%3A%2F%2Fgoogle.com",
		);
	});

	test("includes search when data-track-search is enabled", () => {
		const { sent } = stubDom({
			pathname: "/blog/hello",
			search: "?q=1",
			trackSearch: "true",
		});
		trackPageview();
		expect(sent()).toBe(
			"https://ingestion.edizyurdakul.workers.dev/collect?siteId=site-1&path=%2Fblog%2Fhello%3Fq%3D1",
		);
	});
});
