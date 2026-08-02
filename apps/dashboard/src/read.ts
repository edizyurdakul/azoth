import {
	bounceRate as aggregateBounce,
	breakdown as aggregateBreakdown,
	pageviewsOverTime as aggregatePageviewsOverTime,
	topPages as aggregateTopPages,
	topReferrers as aggregateTopReferrers,
	totalPageviews as aggregateTotalPageviews,
	uniqueVisitors as aggregateUniqueVisitors,
	type Bounce,
	type BreakdownField,
	ipcToEvents,
	type NamedRow,
	type SeriesRow,
	type StoredEvent,
	type TimeBucket,
} from "@azoth/storage";
import {
	bounceRate,
	breakdown,
	pageviewsOverTime,
	type TimeRange,
	topPages,
	topReferrers,
	totalPageviews,
	uniqueVisitors,
} from "./queries";
import type { QueryEnv, QueryResult, QueryRow } from "./query";
import { queryAnalytics } from "./query";

const DAY_MS = 24 * 60 * 60 * 1000;
const AE_RETENTION_MS = 90 * DAY_MS;
const SAFETY_MARGIN_MS = DAY_MS;

const emptyResult: QueryResult = { data: [], rows: 0 };

export interface ReadEnv {
	queryEnv: QueryEnv;
	STORAGE: R2Bucket;
}

function archiveBoundary(now: number): number {
	return now - (AE_RETENTION_MS - SAFETY_MARGIN_MS);
}

function needsArchive(from: number, now: number): boolean {
	return from < archiveBoundary(now);
}

function splitRanges(
	range: TimeRange,
	now: number,
): { ae: TimeRange | null; r2: TimeRange } {
	const boundary = archiveBoundary(now);
	return {
		ae:
			range.to > boundary
				? { ...range, from: Math.max(range.from, boundary) }
				: null,
		r2: { ...range, to: Math.min(range.to, boundary) },
	};
}

function dayKeys(from: number, to: number): string[] {
	const keys: string[] = [];
	const start = new Date(from);
	start.setUTCHours(0, 0, 0, 0);
	const end = new Date(to);
	end.setUTCHours(0, 0, 0, 0);
	let cursor = start;
	while (cursor < end) {
		const y = cursor.getUTCFullYear();
		const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
		const d = String(cursor.getUTCDate()).padStart(2, "0");
		keys.push(`${y}-${m}-${d}`);
		cursor = new Date(cursor.getTime() + DAY_MS);
	}
	return keys;
}

export function storageKey(siteId: string, day: string): string {
	return `v1/${siteId}/${day}.arrow`;
}

async function loadDayEvents(
	env: ReadEnv,
	siteId: string,
	day: string,
): Promise<StoredEvent[]> {
	const object = await env.STORAGE.get(storageKey(siteId, day));
	if (object === null) {
		return [];
	}
	const bytes = new Uint8Array(await object.arrayBuffer());
	return ipcToEvents(bytes);
}

async function archivedEvents(
	env: ReadEnv,
	{ siteId, from, to }: TimeRange,
): Promise<StoredEvent[]> {
	const days = dayKeys(from, to);
	const batches: StoredEvent[][] = await Promise.all(
		days.map((day) => loadDayEvents(env, siteId, day)),
	);
	return batches
		.flat()
		.filter((event) => event.timestamp >= from && event.timestamp < to);
}

function mergeSeries(ae: QueryRow[], r2: SeriesRow[]): SeriesRow[] {
	const merged = new Map<string, number>();
	for (const row of [...ae, ...r2]) {
		const t = String(row.t);
		merged.set(t, (merged.get(t) ?? 0) + Number(row.pageviews ?? 0));
	}
	return [...merged.entries()]
		.map(([t, pageviews]) => ({ t, pageviews: String(pageviews) }))
		.sort((a, b) => a.t.localeCompare(b.t));
}

function mergeNamed(ae: QueryRow[], r2: NamedRow[], limit: number): NamedRow[] {
	const merged = new Map<string, number>();
	for (const row of [...ae, ...r2]) {
		const name = String(row.name ?? "unknown");
		merged.set(name, (merged.get(name) ?? 0) + Number(row.pageviews ?? 0));
	}
	return [...merged.entries()]
		.map(([name, pageviews]) => ({ name, pageviews: String(pageviews) }))
		.sort((a, b) => Number(b.pageviews) - Number(a.pageviews))
		.slice(0, limit);
}

function bounceFromRow(row: QueryRow | undefined): Bounce {
	const bounces = Number(row?.bounces ?? 0);
	const visitors = Number(row?.visitors ?? 0);
	return { bounces, visitors };
}

function mergeBounce(ae: QueryRow, r2: Bounce): Bounce {
	return {
		bounces: Number(ae.bounces ?? 0) + r2.bounces,
		visitors: Number(ae.visitors ?? 0) + r2.visitors,
	};
}

export async function readPageviews(
	env: ReadEnv,
	range: TimeRange,
	bucket: TimeBucket,
	now = Date.now(),
): Promise<{ series: SeriesRow[]; total: number }> {
	if (!needsArchive(range.from, now)) {
		const [series, total] = await Promise.all([
			queryAnalytics(env.queryEnv, pageviewsOverTime(range, bucket)),
			queryAnalytics(env.queryEnv, totalPageviews(range)),
		]);
		return {
			series: series.data as unknown as SeriesRow[],
			total: Number(total.data[0]?.pageviews ?? 0),
		};
	}

	const { ae, r2 } = splitRanges(range, now);
	const [aeSeries, aeTotal, r2Events] = await Promise.all([
		ae ? queryAnalytics(env.queryEnv, pageviewsOverTime(ae, bucket)) : null,
		ae ? queryAnalytics(env.queryEnv, totalPageviews(ae)) : null,
		archivedEvents(env, r2),
	]);
	const r2Series = aggregatePageviewsOverTime(r2Events, bucket);
	return {
		series: aeSeries === null ? r2Series : mergeSeries(aeSeries.data, r2Series),
		total:
			(aeTotal === null ? 0 : Number(aeTotal.data[0]?.pageviews ?? 0)) +
			aggregateTotalPageviews(r2Events),
	};
}

export async function readUniques(
	env: ReadEnv,
	range: TimeRange,
	now = Date.now(),
): Promise<number> {
	if (!needsArchive(range.from, now)) {
		const result = await queryAnalytics(env.queryEnv, uniqueVisitors(range));
		return Number(result.data[0]?.uniques ?? 0);
	}

	const { ae, r2 } = splitRanges(range, now);
	const [aeUniques, r2Events] = await Promise.all([
		ae ? queryAnalytics(env.queryEnv, uniqueVisitors(ae)) : null,
		archivedEvents(env, r2),
	]);
	return (
		(aeUniques === null ? 0 : Number(aeUniques.data[0]?.uniques ?? 0)) +
		aggregateUniqueVisitors(r2Events)
	);
}

export interface BreakdownResult {
	pages: NamedRow[];
	referrers: NamedRow[];
	browsers: NamedRow[];
	oses: NamedRow[];
	devices: NamedRow[];
	countries: NamedRow[];
	bounce: Bounce;
}

const BREAKDOWN_FIELDS: BreakdownField[] = [
	"browser",
	"os",
	"deviceType",
	"country",
];

export async function readBreakdown(
	env: ReadEnv,
	range: TimeRange,
	limit = 10,
	now = Date.now(),
): Promise<BreakdownResult> {
	const archive = needsArchive(range.from, now);
	const { ae, r2 } = archive
		? splitRanges(range, now)
		: { ae: range, r2: range };

	const [pages, referrers, browsers, oses, devices, countries, bounce] =
		(await Promise.all([
			ae
				? queryAnalytics(env.queryEnv, topPages(ae, limit))
				: Promise.resolve(emptyResult),
			ae
				? queryAnalytics(env.queryEnv, topReferrers(ae, limit))
				: Promise.resolve(emptyResult),
			...BREAKDOWN_FIELDS.map((field) =>
				ae
					? queryAnalytics(env.queryEnv, breakdown(ae, field, limit))
					: Promise.resolve(emptyResult),
			),
			ae
				? queryAnalytics(env.queryEnv, bounceRate(ae))
				: Promise.resolve(emptyResult),
		])) as [
			QueryResult,
			QueryResult,
			QueryResult,
			QueryResult,
			QueryResult,
			QueryResult,
			QueryResult,
		];

	if (!archive) {
		return {
			pages: pages.data as unknown as NamedRow[],
			referrers: referrers.data as unknown as NamedRow[],
			browsers: browsers.data as unknown as NamedRow[],
			oses: oses.data as unknown as NamedRow[],
			devices: devices.data as unknown as NamedRow[],
			countries: countries.data as unknown as NamedRow[],
			bounce: bounceFromRow(bounce.data[0]),
		};
	}

	const r2Events = await archivedEvents(env, r2);
	const r2Pages = aggregateTopPages(r2Events, limit);
	const r2Referrers = aggregateTopReferrers(r2Events, limit);
	const r2Browsers = aggregateBreakdown(r2Events, "browser", limit);
	const r2Oses = aggregateBreakdown(r2Events, "os", limit);
	const r2Devices = aggregateBreakdown(r2Events, "deviceType", limit);
	const r2Countries = aggregateBreakdown(r2Events, "country", limit);
	const r2Bounce = aggregateBounce(r2Events);

	return {
		pages: mergeNamed(pages.data, r2Pages, limit),
		referrers: mergeNamed(referrers.data, r2Referrers, limit),
		browsers: mergeNamed(browsers.data, r2Browsers, limit),
		oses: mergeNamed(oses.data, r2Oses, limit),
		devices: mergeNamed(devices.data, r2Devices, limit),
		countries: mergeNamed(countries.data, r2Countries, limit),
		bounce: mergeBounce(bounce.data[0] ?? {}, r2Bounce),
	};
}
