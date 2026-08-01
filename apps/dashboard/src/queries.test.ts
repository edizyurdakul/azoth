import { describe, expect, test } from "vitest";
import { pageviewsOverTime, totalPageviews, uniqueVisitors } from "./queries";

const range = {
	siteId: "site-1",
	from: 1_700_000_000_000,
	to: 1_700_086_400_000,
};

describe("pageviewsOverTime", () => {
	test("buckets by hour with a time-filtered range", () => {
		expect(pageviewsOverTime(range, "hour")).toBe(
			"SELECT toStartOfInterval(toDateTime(toUInt32(double1 / 1000)), INTERVAL '1 HOUR') AS t, COUNT() AS pageviews FROM azoth WHERE index1 = 'site-1' AND double1 >= 1700000000000 AND double1 < 1700086400000 GROUP BY t ORDER BY t ASC",
		);
	});

	test("buckets by day", () => {
		expect(pageviewsOverTime(range, "day")).toContain("INTERVAL '1 DAY'");
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
