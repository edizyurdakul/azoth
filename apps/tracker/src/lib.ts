export interface PageviewUrlParams {
	base: string;
	siteId: string;
	path: string;
	referrer: string;
}

export function buildPageviewUrl({
	base,
	siteId,
	path,
	referrer,
}: PageviewUrlParams): string {
	const url = new URL("/collect", base);
	url.searchParams.set("siteId", siteId);
	url.searchParams.set("path", path);
	if (referrer !== "") {
		url.searchParams.set("referrer", referrer);
	}
	return url.toString();
}

export interface TrackerConfig {
	endpoint: string;
	siteId: string;
}

export function readConfig(): TrackerConfig | null {
	const current = document.currentScript as HTMLScriptElement | null;
	if (current === null) {
		return null;
	}
	const siteId = current.getAttribute("data-site-id") ?? "";
	if (siteId === "") {
		return null;
	}
	const endpoint =
		current.getAttribute("data-endpoint") ?? current.src ?? document.baseURI;
	return { endpoint, siteId };
}

export function trackPageview(): void {
	const config = readConfig();
	if (config === null) {
		return;
	}
	const url = buildPageviewUrl({
		base: config.endpoint,
		siteId: config.siteId,
		path: location.pathname + location.search,
		referrer: document.referrer,
	});
	if (navigator.sendBeacon(url)) {
		return;
	}
	void fetch(url, { method: "POST", keepalive: true });
}
