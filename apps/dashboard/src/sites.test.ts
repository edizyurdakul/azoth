import { describe, expect, test } from "vitest";
import {
	createSite,
	deleteSite,
	embedSnippet,
	getSite,
	isWellFormedSiteId,
	listSites,
	type SiteStore,
} from "./sites";
import { makeMockKV } from "./test/kv";

function store(): SiteStore {
	return makeMockKV();
}

describe("sites registry", () => {
	test("creates a site with a generated siteId and name", async () => {
		const kv = store();
		const site = await createSite(kv, "My Blog");
		expect(site.siteId).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
		expect(site.name).toBe("My Blog");
		expect(site.createdAt).toBeTruthy();
		const fetched = await getSite(kv, site.siteId);
		expect(fetched).toEqual(site);
	});

	test("lists sites sorted by creation time", async () => {
		const kv = store();
		const a = await createSite(kv, "alpha");
		const b = await createSite(kv, "beta");
		const sites = await listSites(kv);
		expect(sites.map((s) => s.siteId)).toEqual([a.siteId, b.siteId]);
	});

	test("deletes a site and reports false for missing sites", async () => {
		const kv = store();
		const site = await createSite(kv, "to-drop");
		expect(await deleteSite(kv, site.siteId)).toBe(true);
		expect(await getSite(kv, site.siteId)).toBeNull();
		expect(await deleteSite(kv, "nope")).toBe(false);
	});

	test("generates distinct siteIds for identical names", async () => {
		const kv = store();
		const a = await createSite(kv, "same");
		const b = await createSite(kv, "same");
		expect(a.siteId).not.toBe(b.siteId);
	});

	test("empty names fall back to the generated siteId", async () => {
		const kv = store();
		const site = await createSite(kv, "   ");
		expect(site.name).toBe(site.siteId);
	});

	test("siteId validation", () => {
		expect(isWellFormedSiteId("my-site")).toBe(true);
		expect(isWellFormedSiteId("a_b-c9")).toBe(true);
		expect(isWellFormedSiteId("")).toBe(false);
		expect(isWellFormedSiteId("has space")).toBe(false);
		expect(isWellFormedSiteId("x".repeat(65))).toBe(false);
	});

	test("embedSnippet points at the ingestion tracker", () => {
		expect(embedSnippet("https://ing.example.com", "abc123")).toBe(
			'<script defer src="https://ing.example.com/tracker.min.js" data-site-id="abc123"></script>',
		);
	});
});
