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
	const interval = bucket === "day" ? "1 DAY" : "1 HOUR";
	return `toStartOfInterval(toDateTime(toUInt32(${doubleColumn("timestamp")} / 1000)), INTERVAL '${interval}')`;
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
