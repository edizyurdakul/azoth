import { UAParser } from "ua-parser-js";

export interface ParsedUa {
	browser: string;
	browserVersion: string;
	os: string;
	deviceType: string;
}

export function parseUa(userAgent: string): ParsedUa {
	const parser = new UAParser(userAgent);
	const browser = parser.getBrowser();
	const os = parser.getOS();
	const device = parser.getDevice();

	let deviceType = "desktop";
	if (device.type === "mobile" || device.type === "tablet") {
		deviceType = device.type;
	}

	return {
		browser: browser.name ?? "",
		browserVersion: browser.version ?? "",
		os: os.name ?? "",
		deviceType,
	};
}
