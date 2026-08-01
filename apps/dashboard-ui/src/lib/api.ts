export interface PageviewsResponse {
	series: Array<{ t: string | number; pageviews: number }>;
	total: number;
}

export interface UniquesResponse {
	uniques: number;
}

export interface OverviewData {
	series: Array<{ t: string | number; pageviews: number }>;
	pageviews: number;
	uniques: number;
}

export interface BreakdownItem {
	name: string;
	pageviews: number;
}

export interface BreakdownData {
	pages: BreakdownItem[];
	referrers: BreakdownItem[];
	browsers: BreakdownItem[];
	oses: BreakdownItem[];
	devices: BreakdownItem[];
	countries: BreakdownItem[];
	bounce: {
		bounces: number;
		visitors: number;
		rate: number;
	};
}

export interface RealtimeData {
	windowMs: number;
	uniques: number;
	pageviews: number;
}

export interface Site {
	siteId: string;
	name: string;
	createdAt: string;
	snippet?: string;
}

export class ApiError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
	}
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(path, { credentials: "include", ...init });
	const text = await res.text();
	if (!res.ok) {
		let message = `request failed (${res.status})`;
		if (text) {
			try {
				const body = JSON.parse(text) as { error?: string };
				if (body.error) {
					message = body.error;
				}
			} catch {
				// non-JSON error body; keep the fallback message
			}
		}
		throw new ApiError(res.status, message);
	}
	if (text === "") {
		return undefined as T;
	}
	return JSON.parse(text) as T;
}

export async function login(secret: string): Promise<void> {
	await requestJson<{ error?: string }>("/api/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ secret }),
	});
}

export async function logout(): Promise<void> {
	await requestJson<{ error?: string }>("/api/logout", { method: "POST" });
}

export async function checkAuth(): Promise<boolean> {
	const res = await fetch("/api/uniques", { credentials: "include" });
	return res.status !== 401;
}

export async function fetchOverview(
	siteId: string,
	from: number,
	to: number,
): Promise<OverviewData> {
	const q = new URLSearchParams({ siteId, from: String(from), to: String(to) });
	const [pv, uniq] = await Promise.all([
		requestJson<PageviewsResponse>(`/api/pageviews?${q}`),
		requestJson<UniquesResponse>(`/api/uniques?${q}`),
	]);
	return {
		series: pv.series,
		pageviews: pv.total,
		uniques: uniq.uniques,
	};
}

export async function fetchBreakdowns(
	siteId: string,
	from: number,
	to: number,
): Promise<BreakdownData> {
	const q = new URLSearchParams({ siteId, from: String(from), to: String(to) });
	return requestJson<BreakdownData>(`/api/breakdown?${q}`);
}

export async function fetchRealtime(siteId: string): Promise<RealtimeData> {
	const q = new URLSearchParams({ siteId });
	return requestJson<RealtimeData>(`/api/realtime?${q}`);
}

export interface SitesResponse {
	sites: Site[];
}

export async function fetchSites(): Promise<Site[]> {
	const body = await requestJson<SitesResponse>("/api/sites");
	return body.sites;
}

export interface CreateSiteResponse {
	site: Site;
	snippet?: string;
}

export async function createSite(name: string): Promise<CreateSiteResponse> {
	return requestJson<CreateSiteResponse>("/api/sites", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name }),
	});
}

export async function deleteSite(siteId: string): Promise<void> {
	await requestJson<{ ok: boolean }>(
		`/api/sites?siteId=${encodeURIComponent(siteId)}`,
		{ method: "DELETE" },
	);
}
