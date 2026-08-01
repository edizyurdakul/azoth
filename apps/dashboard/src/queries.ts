import { blobColumn, doubleColumn, indexColumn } from "@azoth/schema";

const DATASET = "azoth";

export type TimeBucket = "hour" | "day";

export interface TimeRange {
	siteId: string;
	from: number;
	to: number;
}

function rangeClause({ siteId, from, to }: TimeRange): string {
	return `${indexColumn} = '${siteId}' AND ${doubleColumn("timestamp")} >= ${from} AND ${doubleColumn("timestamp")} < ${to}`;
}

function bucketExpression(bucket: TimeBucket): string {
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

export function topPages(range: TimeRange, limit = 10): string {
	return `SELECT ${blobColumn("path")} AS name, COUNT() AS pageviews FROM ${DATASET} WHERE ${rangeClause(range)} GROUP BY name ORDER BY pageviews DESC LIMIT ${limit}`;
}

export function topReferrers(range: TimeRange, limit = 10): string {
	return `SELECT ${blobColumn("referrer")} AS name, COUNT() AS pageviews FROM ${DATASET} WHERE ${rangeClause(range)} AND ${blobColumn("referrer")} != '' GROUP BY name ORDER BY pageviews DESC LIMIT ${limit}`;
}

export function breakdown(
	range: TimeRange,
	field: BreakdownField,
	limit = 10,
): string {
	return `SELECT ${blobColumn(field)} AS name, COUNT() AS pageviews FROM ${DATASET} WHERE ${rangeClause(range)} AND ${blobColumn(field)} != '' GROUP BY name ORDER BY pageviews DESC LIMIT ${limit}`;
}

export function bounceRate(range: TimeRange): string {
	return `SELECT countIf(cnt = 1) AS bounces, COUNT() AS visitors FROM (SELECT COUNT() AS cnt FROM ${DATASET} WHERE ${rangeClause(range)} GROUP BY ${blobColumn("visitorHash")})`;
}
