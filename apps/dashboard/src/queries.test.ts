import { describe, expect, test } from "vitest";
import {
	bounceRate,
	breakdown,
	pageviewsOverTime,
	topPages,
	topReferrers,
	totalPageviews,
	uniqueVisitors,
} from "./queries";

const range = {
	siteId: "site-1",
	from: 1_700_000_000_000,
	to: 1_700_086_400_000,
};

describe("pageviewsOverTime", () => {
	test("buckets by hour with a time-filtered range", () => {
		expect(pageviewsOverTime(range, "hour")).toBe(
			"SELECT toStartOfInterval(toDateTime(toUInt32(double1 / 1000)), INTERVAL '1' HOUR) AS t, COUNT() AS pageviews FROM azoth WHERE index1 = 'site-1' AND double1 >= 1700000000000 AND double1 < 1700086400000 GROUP BY t ORDER BY t ASC",
		);
	});

	test("buckets by day", () => {
		expect(pageviewsOverTime(range, "day")).toContain("INTERVAL '1' DAY");
	});
});

describe("uniqueVisitors", () => {
	test("counts distinct visitorHash (blob8)", () => {
		expect(uniqueVisitors(range)).toBe(
			"SELECT COUNT(DISTINCT blob8) AS uniques FROM azoth WHERE index1 = 'site-1' AND double1 >= 1700000000000 AND double1 < 1700086400000",
		);
	});
});

describe("totalPageviews", () => {
	test("counts all rows in range", () => {
		expect(totalPageviews(range)).toContain("COUNT() AS pageviews");
	});
});

describe("topPages", () => {
	test("groups by path ordered by count desc", () => {
		expect(topPages(range)).toBe(
			"SELECT blob1 AS name, COUNT() AS pageviews FROM azoth WHERE index1 = 'site-1' AND double1 >= 1700000000000 AND double1 < 1700086400000 GROUP BY name ORDER BY pageviews DESC LIMIT 10",
		);
	});
});

describe("topReferrers", () => {
	test("filters out empty referrers", () => {
		expect(topReferrers(range)).toBe(
			"SELECT blob2 AS name, COUNT() AS pageviews FROM azoth WHERE index1 = 'site-1' AND double1 >= 1700000000000 AND double1 < 1700086400000 AND blob2 != '' GROUP BY name ORDER BY pageviews DESC LIMIT 10",
		);
	});
});

describe("breakdown", () => {
	test("maps each breakdown field to its blob column", () => {
		expect(breakdown(range, "browser")).toContain("SELECT blob3 AS name");
		expect(breakdown(range, "os")).toContain("SELECT blob5 AS name");
		expect(breakdown(range, "deviceType")).toContain("SELECT blob6 AS name");
		expect(breakdown(range, "country")).toContain("SELECT blob7 AS name");
	});

	test("excludes empty values and limits", () => {
		expect(breakdown(range, "country")).toContain("AND blob7 != ''");
		expect(breakdown(range, "browser", 5)).toContain("LIMIT 5");
	});
});

describe("bounceRate", () => {
	test("counts visitors appearing exactly once via subquery + countIf", () => {
		expect(bounceRate(range)).toBe(
			"SELECT countIf(cnt = 1) AS bounces, COUNT() AS visitors FROM (SELECT COUNT() AS cnt FROM azoth WHERE index1 = 'site-1' AND double1 >= 1700000000000 AND double1 < 1700086400000 GROUP BY blob8)",
		);
	});
});
