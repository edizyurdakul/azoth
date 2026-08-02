import { describe, expect, test } from "bun:test";
import type { StoredEvent } from "./index";
import { eventsToIpc, ipcToEvents, schemaVersionOf } from "./index";

function sampleEvent(overrides: Partial<StoredEvent> = {}): StoredEvent {
	return {
		siteId: "site-1",
		path: "/",
		referrer: "",
		browser: "Chrome",
		browserVersion: "126.0",
		os: "macOS",
		deviceType: "desktop",
		country: "US",
		visitorHash: "abc123",
		timestamp: 1722560000000,
		sampleInterval: 1,
		...overrides,
	};
}

describe("storage codec", () => {
	test("round-trips events through IPC", () => {
		const events = [
			sampleEvent({ timestamp: 1722560000000 }),
			sampleEvent({ siteId: "site-2", path: "/blog", visitorHash: "def456" }),
		];
		const bytes = eventsToIpc(events, 1);
		const decoded = ipcToEvents(bytes);
		expect(decoded).toEqual(events);
	});

	test("handles empty-string and unicode values", () => {
		const events = [
			sampleEvent({ referrer: "", path: "/日本語" }),
			sampleEvent({ referrer: "https://x.example", path: "🎉" }),
		];
		const decoded = ipcToEvents(eventsToIpc(events, 1));
		expect(decoded).toEqual(events);
	});

	test("encodes schemaVersion", () => {
		const bytes = eventsToIpc([sampleEvent()], 1);
		expect(schemaVersionOf(bytes)).toBe(1);
	});
});
