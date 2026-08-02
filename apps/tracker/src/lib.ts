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

let lastSentPath: string | null = null;

function currentPath(): string | null {
	const config = readConfig();
	if (config === null) {
		return null;
	}
	return config.trackSearch
		? location.pathname + location.search
		: location.pathname;
}

export function trackPageview(options: { referrer?: string } = {}): void {
	const config = readConfig();
	if (config === null) {
		return;
	}
	const path = currentPath();
	if (path === null || path === lastSentPath) {
		return;
	}
	lastSentPath = path;
	const url = buildPageviewUrl({
		base: config.endpoint,
		siteId: config.siteId,
		path,
		referrer: options.referrer ?? document.referrer,
	});
	if (navigator.sendBeacon(url)) {
		return;
	}
	void fetch(url, { method: "POST", keepalive: true });
}

export function initSpaTracking(): void {
	if (typeof history === "undefined" || typeof window === "undefined") {
		return;
	}
	const originalPush = history.pushState.bind(history);
	const originalReplace = history.replaceState.bind(history);

	history.pushState = (data, unused, url) => {
		originalPush(data, unused, url);
		trackPageview({ referrer: "" });
	};
	history.replaceState = (data, unused, url) => {
		const before = currentPath();
		originalReplace(data, unused, url);
		if (currentPath() !== before) {
			trackPageview({ referrer: "" });
		}
	};
	window.addEventListener("popstate", () => {
		trackPageview({ referrer: "" });
	});
}

export function resetTrackerState(): void {
	lastSentPath = null;
}
