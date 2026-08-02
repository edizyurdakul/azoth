import { blobColumn, doubleColumn, SCHEMA_VERSION } from "@azoth/schema";
import type { StoredEvent } from "@azoth/storage";
import { eventsToIpc } from "@azoth/storage";
import type { QueryEnv, QueryRow } from "./query";
import { queryAnalytics } from "./query";

const HOUR_MS = 60 * 60 * 1000;
const HOURS_PER_DAY = 24;

function utcDayRange(day: Date): { start: number; end: number } {
	const start = Date.UTC(
		day.getUTCFullYear(),
		day.getUTCMonth(),
		day.getUTCDate(),
	);
	return { start, end: start + HOURS_PER_DAY * HOUR_MS };
}

export function dayKey(day: Date): string {
	return `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}-${String(day.getUTCDate()).padStart(2, "0")}`;
}

function archiveSelect(hourStartMs: number, hourEndMs: number): string {
	const blobColumns = [
		"path",
		"referrer",
		"browser",
		"browserVersion",
		"os",
		"deviceType",
		"country",
		"visitorHash",
	]
		.map((field) => blobColumn(field as never))
		.join(", ");
	return [
		`SELECT index1 AS site_id, ${blobColumns},`,
		`${doubleColumn("timestamp")} AS timestamp_ms, _sample_interval AS sample_interval`,
		"FROM azoth",
		`WHERE double1 >= ${hourStartMs} AND double1 < ${hourEndMs}`,
	].join(" ");
}

function rowToEvent(row: QueryRow): StoredEvent {
	const num = (value: string | number | null | undefined): number =>
		typeof value === "number" ? value : Number(value ?? 0);
	return {
		siteId: String(row.site_id ?? ""),
		path: String(row.blob1 ?? ""),
		referrer: String(row.blob2 ?? ""),
		browser: String(row.blob3 ?? ""),
		browserVersion: String(row.blob4 ?? ""),
		os: String(row.blob5 ?? ""),
		deviceType: String(row.blob6 ?? ""),
		country: String(row.blob7 ?? ""),
		visitorHash: String(row.blob8 ?? ""),
		timestamp: num(row.timestamp_ms),
		sampleInterval: num(row.sample_interval) || 1,
	};
}

export async function archiveDay(
	env: Cloudflare.Env,
	day: Date,
): Promise<{ written: number; empty: number }> {
	const { start } = utcDayRange(day);
	const queryEnv: QueryEnv = {
		CF_ACCOUNT_ID: env.CF_ACCOUNT_ID,
		CF_API_TOKEN: env.CF_API_TOKEN,
	};

	const bySite = new Map<string, StoredEvent[]>();
	for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
		const hourStart = start + hour * HOUR_MS;
		const result = await queryAnalytics(
			queryEnv,
			archiveSelect(hourStart, hourStart + HOUR_MS),
		);
		for (const row of result.data) {
			const event = rowToEvent(row);
			const list = bySite.get(event.siteId) ?? [];
			list.push(event);
			bySite.set(event.siteId, list);
		}
	}

	const key = dayKey(day);
	let written = 0;
	let empty = 0;
	for (const [siteId, events] of bySite) {
		if (events.length === 0) {
			empty++;
			continue;
		}
		const bytes = eventsToIpc(events, SCHEMA_VERSION);
		await env.STORAGE.put(`v1/${siteId}/${key}.arrow`, bytes);
		written++;
	}
	return { written, empty };
}
