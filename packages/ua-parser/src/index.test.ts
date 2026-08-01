import { describe, expect, test } from "bun:test";
import { parseUa } from "./index";

const CHROME_DESKTOP =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const IPHONE_SAFARI =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_SAFARI =
	"Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
	"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";

describe("@azoth/ua-parser", () => {
	test("desktop chrome", () => {
		expect(parseUa(CHROME_DESKTOP)).toEqual({
			browser: "Chrome",
			browserVersion: "126.0.0.0",
			os: "Windows",
			deviceType: "desktop",
		});
	});

	test("iphone safari", () => {
		expect(parseUa(IPHONE_SAFARI)).toEqual({
			browser: "Mobile Safari",
			browserVersion: "17.5",
			os: "iOS",
			deviceType: "mobile",
		});
	});

	test("ipad safari", () => {
		expect(parseUa(IPAD_SAFARI).deviceType).toBe("tablet");
	});

	test("android chrome", () => {
		const parsed = parseUa(ANDROID_CHROME);
		expect(parsed.browser).toBe("Mobile Chrome");
		expect(parsed.os).toBe("Android");
		expect(parsed.deviceType).toBe("mobile");
	});

	test("empty user agent falls back to empty fields and desktop", () => {
		expect(parseUa("")).toEqual({
			browser: "",
			browserVersion: "",
			os: "",
			deviceType: "desktop",
		});
	});
});
