export const SITE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export interface Site {
	siteId: string;
	name: string;
	createdAt: string;
}

export interface SiteStore {
	get(key: string): Promise<string | null>;
	put(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
	list(options?: {
		prefix?: string;
	}): Promise<{ keys: Array<{ name: string }> }>;
}

const SITE_KEY_PREFIX = "site:";

export function siteKey(siteId: string): string {
	return `${SITE_KEY_PREFIX}${siteId}`;
}

export function parseSite(json: string): Site {
	return JSON.parse(json) as Site;
}

export function isWellFormedSiteId(siteId: string): boolean {
	return SITE_ID_PATTERN.test(siteId);
}

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

function randomId(length: number): string {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}

async function uniqueSiteId(store: SiteStore, name: string): Promise<string> {
	const slug = slugify(name);
	const base = slug !== "" ? slug : randomId(10);
	const candidate =
		(await store.get(siteKey(base))) === null ? base : `${base}-${randomId(6)}`;
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const id = attempt === 0 ? candidate : `${base}-${randomId(6)}`;
		if ((await store.get(siteKey(id))) === null) {
			return id;
		}
	}
	return `${base}-${randomId(10)}`;
}

export async function listSites(store: SiteStore): Promise<Site[]> {
	const { keys } = await store.list({ prefix: SITE_KEY_PREFIX });
	const sites = await Promise.all(
		keys.map(async (key) => {
			const raw = await store.get(key.name);
			return raw === null ? null : parseSite(raw);
		}),
	);
	return sites
		.filter((site): site is Site => site !== null)
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getSite(
	store: SiteStore,
	siteId: string,
): Promise<Site | null> {
	const raw = await store.get(siteKey(siteId));
	return raw === null ? null : parseSite(raw);
}

export async function createSite(
	store: SiteStore,
	name: string,
): Promise<Site> {
	const siteId = await uniqueSiteId(store, name);
	const site: Site = {
		siteId,
		name: name.trim() === "" ? siteId : name.trim(),
		createdAt: new Date().toISOString(),
	};
	await store.put(siteKey(site.siteId), JSON.stringify(site));
	return site;
}

export async function deleteSite(
	store: SiteStore,
	siteId: string,
): Promise<boolean> {
	const existing = await store.get(siteKey(siteId));
	if (existing === null) {
		return false;
	}
	await store.delete(siteKey(siteId));
	return true;
}

export function embedSnippet(ingestionUrl: string, siteId: string): string {
	return `<script defer src="${ingestionUrl}/tracker.min.js" data-site-id="${siteId}"></script>`;
}
