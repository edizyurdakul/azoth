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
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as {
			error?: string;
		} | null;
		throw new ApiError(
			res.status,
			body?.error ?? `request failed (${res.status})`,
		);
	}
	return (await res.json()) as T;
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
