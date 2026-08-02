import type { StoredEvent } from "./writer";

export type TimeBucket = "hour" | "day";

export interface SeriesRow {
	t: string;
	pageviews: string;
}

export interface EventSeriesRow {
	t: string;
	events: string;
}

export interface NamedRow {
	name: string;
	pageviews: string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

export function bucketStartMs(timestampMs: number, bucket: TimeBucket): number {
	const unit = bucket === "day" ? DAY_MS : HOUR_MS;
	return Math.floor(timestampMs / unit) * unit;
}

export function formatT(bucketStartMs: number): string {
	const d = new Date(bucketStartMs);
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

export function totalPageviews(events: readonly StoredEvent[]): number {
	return events.length;
}

export function uniqueVisitors(events: readonly StoredEvent[]): number {
	return new Set(events.map((e) => e.visitorHash)).size;
}

export function pageviewsOverTime(
	events: readonly StoredEvent[],
	bucket: TimeBucket,
): SeriesRow[] {
	const counts = new Map<string, number>();
	for (const event of events) {
		const key = formatT(bucketStartMs(event.timestamp, bucket));
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([t, pageviews]) => ({ t, pageviews: String(pageviews) }))
		.sort((a, b) => a.t.localeCompare(b.t));
}

export function eventsOverTime(
	events: readonly StoredEvent[],
	bucket: TimeBucket,
): EventSeriesRow[] {
	const counts = new Map<string, number>();
	for (const event of events) {
		const key = formatT(bucketStartMs(event.timestamp, bucket));
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([t, eventsCount]) => ({ t, events: String(eventsCount) }))
		.sort((a, b) => a.t.localeCompare(b.t));
}

const BREAKDOWN_FIELDS = ["browser", "os", "deviceType", "country"] as const;

export type BreakdownField = (typeof BREAKDOWN_FIELDS)[number];

type GroupableField = "path" | "referrer" | BreakdownField;

function topByField(
	events: readonly StoredEvent[],
	field: GroupableField,
	excludeEmpty: boolean,
	limit: number,
): NamedRow[] {
	const counts = new Map<string, number>();
	for (const event of events) {
		const name = event[field];
		if (excludeEmpty && name === "") {
			continue;
		}
		counts.set(name, (counts.get(name) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([name, pageviews]) => ({ name, pageviews: String(pageviews) }))
		.sort((a, b) => Number(b.pageviews) - Number(a.pageviews))
		.slice(0, limit);
}

export function topPages(
	events: readonly StoredEvent[],
	limit: number,
): NamedRow[] {
	return topByField(events, "path", false, limit);
}

export function topReferrers(
	events: readonly StoredEvent[],
	limit: number,
): NamedRow[] {
	return topByField(events, "referrer", true, limit);
}

export function breakdown(
	events: readonly StoredEvent[],
	field: BreakdownField,
	limit: number,
): NamedRow[] {
	return topByField(events, field, true, limit);
}

export interface Bounce {
	bounces: number;
	visitors: number;
}

export function bounceRate(events: readonly StoredEvent[]): Bounce {
	const counts = new Map<string, number>();
	for (const event of events) {
		counts.set(event.visitorHash, (counts.get(event.visitorHash) ?? 0) + 1);
	}
	let bounces = 0;
	for (const count of counts.values()) {
		if (count === 1) {
			bounces++;
		}
	}
	return { bounces, visitors: counts.size };
}
