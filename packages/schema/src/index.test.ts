import { describe, expect, test } from "bun:test";
import {
	BLOB_FIELDS,
	blobColumn,
	DOUBLE_FIELDS,
	doubleColumn,
	INDEX_FIELD,
	indexColumn,
	type PageviewEvent,
	toWriteDataPoint,
} from "./index";

const event: PageviewEvent = {
	siteId: "site-1",
	path: "/",
	referrer: "",
	browser: "Chrome",
	browserVersion: "126",
	os: "Windows",
	deviceType: "desktop",
	country: "US",
	visitorHash: "abc123",
	timestamp: 1_700_000_000_000,
};

describe("@azoth/schema", () => {
	test("index field is siteId", () => {
		expect(INDEX_FIELD).toBe("siteId");
	});

	test("blob field order is fixed", () => {
		expect(BLOB_FIELDS).toEqual([
			"path",
			"referrer",
			"browser",
			"browserVersion",
			"os",
			"deviceType",
			"country",
			"visitorHash",
		]);
	});

	test("double fields are only timestamp", () => {
		expect(DOUBLE_FIELDS).toEqual(["timestamp"]);
	});

	test("toWriteDataPoint maps fields in declared order", () => {
		const dp = toWriteDataPoint(event);

		expect(dp.indexes).toEqual([event.siteId]);
		expect(dp.doubles).toEqual([event.timestamp]);
		expect([...dp.blobs]).toEqual(BLOB_FIELDS.map((field) => event[field]));
	});

	test("blobColumn is 1-indexed by field order", () => {
		expect(blobColumn("path")).toBe("blob1");
		expect(blobColumn("visitorHash")).toBe(`blob${BLOB_FIELDS.length}`);
	});

	test("doubleColumn maps timestamp to double1", () => {
		expect(doubleColumn("timestamp")).toBe("double1");
	});

	test("indexColumn is index1 for siteId", () => {
		expect(indexColumn).toBe("index1");
	});
});
