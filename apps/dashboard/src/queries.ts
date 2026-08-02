import { blobColumn, doubleColumn, indexColumn } from "@azoth/schema";

const DATASET = "azoth";

export type TimeBucket = "hour" | "day";

export interface TimeRange {
	siteId: string;
	from: number;
	to: number;
}

const SITE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function assertTimeRange(from: number, to: number): void {
	if (
		!Number.isFinite(from) ||
		from < 0 ||
		!Number.isFinite(to) ||
		to < 0 ||
		to <= from
	) {
		throw new Error("invalid time range");
	}
}

function rangeClause({ siteId, from, to }: TimeRange): string {
	if (!SITE_ID_PATTERN.test(siteId)) {
		throw new Error("invalid time range");
	}
	assertTimeRange(from, to);
	return `${indexColumn} = '${siteId}' AND ${doubleColumn("timestamp")} >= ${from} AND ${doubleColumn("timestamp")} < ${to}`;
}

function bucketExpression(bucket: TimeBucket): string {
	if (bucket !== "hour" && bucket !== "day") {
		throw new Error("invalid bucket");
	}
	const unit = bucket === "day" ? "DAY" : "HOUR";
	return `toStartOfInterval(toDateTime(toUInt32(${doubleColumn("timestamp")} / 1000)), INTERVAL '1' ${unit})`;
}

export function pageviewsOverTime(
	range: TimeRange,
	bucket: TimeBucket,
): string {
	return `SELECT ${bucketExpression(bucket)} AS t, COUNT() AS pageviews FROM ${DATASET} WHERE ${rangeClause(range)} GROUP BY t ORDER BY t ASC`;
}

export function uniqueVisitors(range: TimeRange): string {
	return `SELECT COUNT(DISTINCT ${blobColumn("visitorHash")}) AS uniques FROM ${DATASET} WHERE ${rangeClause(range)}`;
}

export function totalPageviews(range: TimeRange): string {
	return `SELECT COUNT() AS pageviews FROM ${DATASET} WHERE ${rangeClause(range)}`;
}

const BREAKDOWN_FIELDS = ["browser", "os", "deviceType", "country"] as const;

export type BreakdownField = (typeof BREAKDOWN_FIELDS)[number];

function assertLimit(limit: number): void {
	if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
		throw new Error("invalid limit");
	}
}

export function topPages(range: TimeRange, limit = 10): string {
	assertLimit(limit);
	return `SELECT ${blobColumn("path")} AS name, COUNT() AS pageviews FROM ${DATASET} WHERE ${rangeClause(range)} GROUP BY name ORDER BY pageviews DESC LIMIT ${limit}`;
}

export function topReferrers(range: TimeRange, limit = 10): string {
	assertLimit(limit);
	return `SELECT ${blobColumn("referrer")} AS name, COUNT() AS pageviews FROM ${DATASET} WHERE ${rangeClause(range)} AND ${blobColumn("referrer")} != '' GROUP BY name ORDER BY pageviews DESC LIMIT ${limit}`;
}

export function breakdown(
	range: TimeRange,
	field: BreakdownField,
	limit = 10,
): string {
	assertLimit(limit);
	return `SELECT ${blobColumn(field)} AS name, COUNT() AS pageviews FROM ${DATASET} WHERE ${rangeClause(range)} AND ${blobColumn(field)} != '' GROUP BY name ORDER BY pageviews DESC LIMIT ${limit}`;
}

export function bounceRate(range: TimeRange): string {
	return `SELECT countIf(cnt = 1) AS bounces, COUNT() AS visitors FROM (SELECT COUNT() AS cnt FROM ${DATASET} WHERE ${rangeClause(range)} GROUP BY ${blobColumn("visitorHash")})`;
}

export interface AccountRange {
	from: number;
	to: number;
}

function accountRangeClause({ from, to }: AccountRange): string {
	assertTimeRange(from, to);
	return `${doubleColumn("timestamp")} >= ${from} AND ${doubleColumn("timestamp")} < ${to}`;
}

export function totalEvents({ from, to }: AccountRange): string {
	return `SELECT COUNT() AS events FROM ${DATASET} WHERE ${accountRangeClause({ from, to })}`;
}

export function eventsOverTime(
	{ from, to }: AccountRange,
	bucket: TimeBucket,
): string {
	return `SELECT ${bucketExpression(bucket)} AS t, COUNT() AS events FROM ${DATASET} WHERE ${accountRangeClause({ from, to })} GROUP BY t ORDER BY t ASC`;
}
