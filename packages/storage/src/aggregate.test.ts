import { describe, expect, test } from "bun:test";
import {
	bounceRate,
	breakdown,
	eventsOverTime,
	pageviewsOverTime,
	topPages,
	topReferrers,
	totalPageviews,
	uniqueVisitors,
} from "./aggregate";
import type { StoredEvent } from "./index";

function event(
	timestamp: number,
	overrides: Partial<StoredEvent> = {},
): StoredEvent {
	return {
		siteId: "site-1",
		path: "/",
		referrer: "",
		browser: "Chrome",
		browserVersion: "126.0",
		os: "macOS",
		deviceType: "desktop",
		country: "US",
		visitorHash: "abc",
		timestamp,
		sampleInterval: 1,
		...overrides,
	};
}

// 2026-08-01 00:00:00 UTC = 1785542400000
const AUG1 = 1785542400000;
const HOUR = 3600 * 1000;

describe("aggregate", () => {
	test("pageviewsOverTime matches AE shape and bucketing", () => {
		const events = [
			event(AUG1),
			event(AUG1 + 30 * 60 * 1000),
			event(AUG1 + 60 * 60 * 1000),
			event(AUG1 + 25 * HOUR),
		];
		expect(pageviewsOverTime(events, "hour")).toEqual([
			{ t: "2026-08-01 00:00:00", pageviews: "2" },
			{ t: "2026-08-01 01:00:00", pageviews: "1" },
			{ t: "2026-08-02 01:00:00", pageviews: "1" },
		]);
		expect(pageviewsOverTime(events, "day")).toEqual([
			{ t: "2026-08-01 00:00:00", pageviews: "3" },
			{ t: "2026-08-02 00:00:00", pageviews: "1" },
		]);
	});

	test("eventsOverTime uses events key", () => {
		const events = [event(AUG1), event(AUG1 + HOUR)];
		expect(eventsOverTime(events, "day")).toEqual([
			{ t: "2026-08-01 00:00:00", events: "2" },
		]);
	});

	test("totalPageviews and uniqueVisitors", () => {
		const events = [
			event(AUG1),
			event(AUG1 + HOUR, { visitorHash: "abc" }),
			event(AUG1 + 2 * HOUR, { visitorHash: "def" }),
		];
		expect(totalPageviews(events)).toBe(3);
		expect(uniqueVisitors(events)).toBe(2);
	});

	test("topPages / topReferrers / breakdown", () => {
		const events = [
			event(AUG1, { path: "/a" }),
			event(AUG1 + HOUR, { path: "/b", referrer: "https://x" }),
			event(AUG1 + 2 * HOUR, { path: "/a" }),
			event(AUG1 + 3 * HOUR, { path: "/c", browser: "Firefox" }),
		];
		expect(topPages(events, 10)).toEqual([
			{ name: "/a", pageviews: "2" },
			{ name: "/b", pageviews: "1" },
			{ name: "/c", pageviews: "1" },
		]);
		expect(topPages(events, 2)).toHaveLength(2);
		expect(topReferrers(events, 10)).toEqual([
			{ name: "https://x", pageviews: "1" },
		]);
		expect(breakdown(events, "browser", 10)).toEqual([
			{ name: "Chrome", pageviews: "3" },
			{ name: "Firefox", pageviews: "1" },
		]);
	});

	test("bounceRate counts visitorHash with exactly one row", () => {
		const events = [
			event(AUG1, { visitorHash: "a" }),
			event(AUG1 + HOUR, { visitorHash: "a" }),
			event(AUG1 + 2 * HOUR, { visitorHash: "b" }),
		];
		expect(bounceRate(events)).toEqual({ bounces: 1, visitors: 2 });
	});
});
