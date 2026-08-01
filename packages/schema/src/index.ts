export const INDEX_FIELD = "siteId";

export const BLOB_FIELDS = [
	"path",
	"referrer",
	"browser",
	"browserVersion",
	"os",
	"deviceType",
	"country",
	"visitorHash",
] as const;

export const DOUBLE_FIELDS = ["timestamp"] as const;

export interface PageviewEvent {
	siteId: string;
	path: string;
	referrer: string;
	browser: string;
	browserVersion: string;
	os: string;
	deviceType: string;
	country: string;
	visitorHash: string;
	timestamp: number;
}

export interface WriteDataPoint {
	indexes: [string];
	blobs: [string, string, string, string, string, string, string, string];
	doubles: [number];
}

export function toWriteDataPoint(event: PageviewEvent): WriteDataPoint {
	return {
		indexes: [event.siteId],
		blobs: [
			event.path,
			event.referrer,
			event.browser,
			event.browserVersion,
			event.os,
			event.deviceType,
			event.country,
			event.visitorHash,
		],
		doubles: [event.timestamp],
	};
}
