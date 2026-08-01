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

export function blobColumn(field: (typeof BLOB_FIELDS)[number]): string {
	const index = BLOB_FIELDS.indexOf(field);
	return `blob${index + 1}`;
}

export function doubleColumn(field: (typeof DOUBLE_FIELDS)[number]): string {
	const index = DOUBLE_FIELDS.indexOf(field);
	return `double${index + 1}`;
}

export const indexColumn = `index${1}`;

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

type MapTuple<T extends readonly unknown[], U> = {
	-readonly [K in keyof T]: U;
};

export interface WriteDataPoint {
	indexes: [string];
	blobs: MapTuple<typeof BLOB_FIELDS, string>;
	doubles: [number];
}

export function toWriteDataPoint(event: PageviewEvent): WriteDataPoint {
	return {
		indexes: [event.siteId],
		blobs: BLOB_FIELDS.map((field) => event[field]) as WriteDataPoint["blobs"],
		doubles: [event.timestamp],
	};
}
