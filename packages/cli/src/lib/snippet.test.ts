import { describe, expect, it } from "bun:test";
import { generateAuthSecret } from "./auth";
import { embedSnippet, testCurl } from "./snippet";

describe("auth", () => {
	it("generates a 64-char hex secret", () => {
		const secret = generateAuthSecret();
		expect(secret).toMatch(/^[a-f0-9]{64}$/);
	});

	it("generates distinct secrets", () => {
		expect(generateAuthSecret()).not.toBe(generateAuthSecret());
	});
});

describe("snippet", () => {
	const params = {
		ingestionUrl: "https://ingestion.edizyurdakul.workers.dev",
		dashboardUrl: "https://dashboard.edizyurdakul.workers.dev",
		siteId: "my-site",
	};

	it("builds the embed snippet with data-site-id", () => {
		expect(embedSnippet(params)).toBe(
			'<script defer src="https://ingestion.edizyurdakul.workers.dev/tracker.min.js" data-site-id="my-site"></script>',
		);
	});

	it("builds a test curl", () => {
		expect(testCurl(params)).toBe(
			"curl -X POST 'https://ingestion.edizyurdakul.workers.dev/collect?siteId=test&path=%2F'",
		);
	});
});
