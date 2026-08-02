import { tableFromIPC } from "apache-arrow";
import type { StoredEvent } from "./writer";

export function ipcToEvents(bytes: Uint8Array): StoredEvent[] {
	const table = tableFromIPC(bytes);
	const events: StoredEvent[] = [];
	const rows = table.numRows;
	for (let i = 0; i < rows; i++) {
		const row = table.get(i);
		if (!row) {
			continue;
		}
		events.push({
			siteId: String(row.siteId),
			path: String(row.path),
			referrer: String(row.referrer),
			browser: String(row.browser),
			browserVersion: String(row.browserVersion),
			os: String(row.os),
			deviceType: String(row.deviceType),
			country: String(row.country),
			visitorHash: String(row.visitorHash),
			timestamp: Number(row.timestamp),
			sampleInterval: Number(row.sampleInterval),
		});
	}
	return events;
}

export function schemaVersionOf(bytes: Uint8Array): number {
	const table = tableFromIPC(bytes);
	const field = table.schema.fields.find((f) => f.name === "schemaVersion");
	if (!field) {
		throw new Error("missing schemaVersion column");
	}
	const first = table.get(0);
	if (!first) {
		throw new Error("empty file");
	}
	return Number(first.schemaVersion);
}
