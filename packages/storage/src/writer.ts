import type { PageviewEvent } from "@azoth/schema";
import { Table, tableToIPC } from "apache-arrow";
import { float64Vector, int32Vector, utf8Vector } from "./columns";

export interface StoredEvent extends PageviewEvent {
	siteId: string;
	timestamp: number;
	sampleInterval: number;
}

export function eventsToIpc(
	events: readonly StoredEvent[],
	schemaVersion: number,
): Uint8Array {
	const n = events.length;
	const table = new Table({
		siteId: utf8Vector(events.map((e) => e.siteId)),
		path: utf8Vector(events.map((e) => e.path)),
		referrer: utf8Vector(events.map((e) => e.referrer)),
		browser: utf8Vector(events.map((e) => e.browser)),
		browserVersion: utf8Vector(events.map((e) => e.browserVersion)),
		os: utf8Vector(events.map((e) => e.os)),
		deviceType: utf8Vector(events.map((e) => e.deviceType)),
		country: utf8Vector(events.map((e) => e.country)),
		visitorHash: utf8Vector(events.map((e) => e.visitorHash)),
		timestamp: float64Vector(events.map((e) => e.timestamp)),
		sampleInterval: int32Vector(events.map((e) => e.sampleInterval)),
		schemaVersion: int32Vector(new Array(n).fill(schemaVersion)),
	});
	return tableToIPC(table, "file");
}
