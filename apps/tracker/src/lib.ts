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
	const referrerOrigin = originOnly(referrer);
	if (referrerOrigin !== "") {
		url.searchParams.set("referrer", referrerOrigin);
	}
	return url.toString();
}

function originOnly(referrer: string): string {
	if (referrer === "") {
		return "";
	}
	try {
		return new URL(referrer).origin;
	} catch {
		return "";
	}
}

export interface TrackerConfig {
	endpoint: string;
	siteId: string;
	trackSearch: boolean;
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
	const trackSearch = current.getAttribute("data-track-search") === "true";
	return { endpoint, siteId, trackSearch };
}

export function trackPageview(): void {
	const config = readConfig();
	if (config === null) {
		return;
	}
	const url = buildPageviewUrl({
		base: config.endpoint,
		siteId: config.siteId,
		path: config.trackSearch
			? location.pathname + location.search
			: location.pathname,
		referrer: document.referrer,
	});
	if (navigator.sendBeacon(url)) {
		return;
	}
	void fetch(url, { method: "POST", keepalive: true });
}
