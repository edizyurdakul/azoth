import { afterEach, describe, expect, test } from "bun:test";
import {
	buildPageviewUrl,
	initSpaTracking,
	isOptedOut,
	resetTrackerState,
	trackPageview,
} from "./lib";

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

function stubSpaDom({
	pathname = "/",
	search = "",
	historyState = {},
}: {
	pathname?: string;
	search?: string;
	historyState?: Record<string, unknown>;
} = {}) {
	let sent = "";
	let currentPathname = pathname;
	const currentSearch = search;
	const listeners: Record<string, Array<() => void>> = {};
	const script = {
		src: "https://ingestion.edizyurdakul.workers.dev/tracker.min.js",
		getAttribute(name: string) {
			if (name === "data-site-id") {
				return "site-1";
			}
			return null;
		},
	};
	(globalThis as Record<string, unknown>).document = {
		currentScript: script,
		referrer: "",
		baseURI: "https://ingestion.edizyurdakul.workers.dev/",
	};
	const location = {
		get pathname() {
			return currentPathname;
		},
		get search() {
			return currentSearch;
		},
	};
	(globalThis as Record<string, unknown>).location = location;
	const historyStateRecord: Record<string, unknown> = historyState;
	const history = {
		pushState: (state: unknown, _unused: string, url?: string | URL) => {
			historyStateRecord.state = state;
			currentPathname = String(url);
		},
		replaceState: (state: unknown, _unused: string, url?: string | URL) => {
			historyStateRecord.state = state;
			currentPathname = String(url);
		},
	};
	const window = {
		addEventListener: (event: string, cb: () => void) => {
			if (listeners[event] === undefined) {
				listeners[event] = [];
			}
			listeners[event].push(cb);
		},
	};
	(globalThis as Record<string, unknown>).history = history;
	(globalThis as Record<string, unknown>).window = window;
	(globalThis as Record<string, unknown>).navigator = {
		sendBeacon: (url: string) => {
			sent = url;
			return true;
		},
	};
	return {
		sent: () => sent,
		navigate: (url: string) => history.pushState({}, "", url),
		replace: (url: string) => history.replaceState({}, "", url),
		pop: () => {
			for (const cb of listeners.popstate ?? []) {
				cb();
			}
		},
	};
}

afterEach(() => {
	resetTrackerState();
	delete (globalThis as Record<string, unknown>).document;
	delete (globalThis as Record<string, unknown>).location;
	delete (globalThis as Record<string, unknown>).navigator;
	delete (globalThis as Record<string, unknown>).history;
	delete (globalThis as Record<string, unknown>).window;
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

describe("isOptedOut", () => {
	function stubNavigator(nav: Record<string, unknown>) {
		(globalThis as Record<string, unknown>).navigator = nav;
	}

	afterEach(() => {
		delete (globalThis as Record<string, unknown>).navigator;
	});

	test("returns false when neither GPC nor DNT is set", () => {
		stubNavigator({ sendBeacon: () => true });
		expect(isOptedOut()).toBe(false);
	});

	test("returns true when globalPrivacyControl is set", () => {
		stubNavigator({ globalPrivacyControl: true, sendBeacon: () => true });
		expect(isOptedOut()).toBe(true);
	});

	test("returns true when doNotTrack is 1", () => {
		stubNavigator({ doNotTrack: "1", sendBeacon: () => true });
		expect(isOptedOut()).toBe(true);
	});

	test("returns false when doNotTrack is unset or 0", () => {
		stubNavigator({ doNotTrack: "0", sendBeacon: () => true });
		expect(isOptedOut()).toBe(false);
	});
});

describe("trackPageview with privacy signals", () => {
	test("does not send a pageview when globalPrivacyControl is set", () => {
		const { sent } = stubDom({});
		(globalThis as Record<string, unknown>).navigator = {
			globalPrivacyControl: true,
			sendBeacon: (url: string) => {
				// no-op
				void url;
				return true;
			},
		};
		trackPageview();
		expect(sent()).toBe("");
	});

	test("does not send a pageview when doNotTrack is 1", () => {
		const { sent } = stubDom({});
		(globalThis as Record<string, unknown>).navigator = {
			doNotTrack: "1",
			sendBeacon: (url: string) => {
				void url;
				return true;
			},
		};
		trackPageview();
		expect(sent()).toBe("");
	});
});

describe("initSpaTracking", () => {
	test("fires a pageview when history.pushState navigates", () => {
		const dom = stubSpaDom({ pathname: "/" });
		initSpaTracking();
		expect(dom.sent()).toBe("");
		dom.navigate("/blog/hello");
		expect(dom.sent()).toBe(
			"https://ingestion.edizyurdakul.workers.dev/collect?siteId=site-1&path=%2Fblog%2Fhello",
		);
	});

	test("fires a pageview on replaceState only when the path changes", () => {
		const dom = stubSpaDom({ pathname: "/blog/hello" });
		initSpaTracking();
		dom.replace("/blog/hello");
		expect(dom.sent()).toBe("");
		dom.replace("/about");
		expect(dom.sent()).toBe(
			"https://ingestion.edizyurdakul.workers.dev/collect?siteId=site-1&path=%2Fabout",
		);
	});

	test("fires a pageview on popstate", () => {
		const dom = stubSpaDom({ pathname: "/blog/hello" });
		initSpaTracking();
		dom.navigate("/about");
		dom.pop();
		expect(dom.sent()).toBe(
			"https://ingestion.edizyurdakul.workers.dev/collect?siteId=site-1&path=%2Fabout",
		);
	});

	test("dedupes consecutive fires for the same path", () => {
		const dom = stubSpaDom({ pathname: "/blog/hello" });
		initSpaTracking();
		dom.navigate("/blog/hello");
		const first = dom.sent();
		dom.navigate("/blog/hello");
		expect(dom.sent()).toBe(first);
		expect(first).toBe(
			"https://ingestion.edizyurdakul.workers.dev/collect?siteId=site-1&path=%2Fblog%2Fhello",
		);
	});

	test("strips the referrer on SPA navigations", () => {
		const dom = stubSpaDom({ pathname: "/" });
		(globalThis as Record<string, unknown>).document = {
			currentScript: {
				src: "https://ingestion.edizyurdakul.workers.dev/tracker.min.js",
				getAttribute: (name: string) =>
					name === "data-site-id" ? "site-1" : null,
			},
			referrer: "https://google.com/search?q=azoth",
			baseURI: "https://ingestion.edizyurdakul.workers.dev/",
		};
		initSpaTracking();
		dom.navigate("/about");
		expect(dom.sent()).toBe(
			"https://ingestion.edizyurdakul.workers.dev/collect?siteId=site-1&path=%2Fabout",
		);
		expect(dom.sent()).not.toContain("referrer=");
	});
});
