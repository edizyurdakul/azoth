import { authCookie, clearAuthCookie, isAuthorized } from "./auth";
import {
	bounceRate,
	breakdown,
	eventsOverTime,
	pageviewsOverTime,
	type TimeBucket,
	type TimeRange,
	topPages,
	topReferrers,
	totalEvents,
	totalPageviews,
	uniqueVisitors,
} from "./queries";
import { type QueryEnv, QueryError, queryAnalytics } from "./query";
import {
	createSite,
	deleteSite,
	embedSnippet,
	isWellFormedSiteId,
	listSites,
} from "./sites";

const SITE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function isValidSiteId(siteId: string | null): siteId is string {
	return siteId !== null && SITE_ID_PATTERN.test(siteId);
}

function parseTimestamp(raw: string | null): number | null {
	if (raw === null) {
		return null;
	}
	const value = Number(raw);
	return Number.isFinite(value) && value >= 0 ? value : null;
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function breakdownRows(
	rows: Array<{
		name?: string | number | null;
		pageviews?: string | number | null;
	}>,
): Array<{ name: string; pageviews: number }> {
	return rows.map((row) => ({
		name: String(row.name ?? "unknown"),
		pageviews: Number(row.pageviews ?? 0),
	}));
}

const REALTIME_WINDOW_MS = 5 * 60 * 1000;

async function handleSites(
	request: Request,
	env: Cloudflare.Env,
): Promise<Response> {
	const url = new URL(request.url);

	switch (request.method) {
		case "GET": {
			const sites = await listSites(env.SITES);
			const ingestionUrl = env.INGESTION_URL ?? "";
			return json({
				sites: sites.map((site) => ({
					...site,
					snippet:
						ingestionUrl === "" ? "" : embedSnippet(ingestionUrl, site.siteId),
				})),
			});
		}
		case "POST": {
			const body = (await request.json().catch(() => null)) as {
				name?: unknown;
			} | null;
			if (
				body === null ||
				typeof body.name !== "string" ||
				body.name.trim() === ""
			) {
				return json({ error: "missing site name" }, 400);
			}
			const site = await createSite(env.SITES, body.name);
			const ingestionUrl = env.INGESTION_URL ?? "";
			return json({
				site,
				snippet:
					ingestionUrl === "" ? "" : embedSnippet(ingestionUrl, site.siteId),
			});
		}
		case "DELETE": {
			const siteId = url.searchParams.get("siteId");
			if (siteId === null || !isWellFormedSiteId(siteId)) {
				return json({ error: "invalid siteId" }, 400);
			}
			const removed = await deleteSite(env.SITES, siteId);
			if (!removed) {
				return json({ error: "site not found" }, 404);
			}
			return json({ ok: true });
		}
		default:
			return json({ error: "method not allowed" }, 405);
	}
}

export default {
	async fetch(request: Request, env: Cloudflare.Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/api/login" && request.method === "POST") {
			const secret = (await request.json().catch(() => null)) as {
				secret?: unknown;
			} | null;
			if (typeof secret?.secret !== "string" || secret.secret === "") {
				return json({ error: "missing secret" }, 400);
			}
			if (secret.secret !== env.AUTH_SECRET) {
				return json({ error: "unauthorized" }, 401);
			}
			return new Response(null, {
				status: 200,
				headers: { "Set-Cookie": authCookie(env.AUTH_SECRET) },
			});
		}

		if (url.pathname === "/api/logout" && request.method === "POST") {
			return new Response(null, {
				status: 200,
				headers: { "Set-Cookie": clearAuthCookie() },
			});
		}

		if (!isAuthorized(request, env)) {
			return json({ error: "unauthorized" }, 401);
		}

		if (url.pathname === "/api/sites") {
			return handleSites(request, env);
		}

		if (request.method !== "GET") {
			return json({ error: "method not allowed" }, 405);
		}

		const queryEnv: QueryEnv = {
			CF_ACCOUNT_ID: env.CF_ACCOUNT_ID,
			CF_API_TOKEN: env.CF_API_TOKEN,
		};

		if (url.pathname === "/api/usage") {
			const from = parseTimestamp(url.searchParams.get("from"));
			const to = parseTimestamp(url.searchParams.get("to"));
			if (from === null || to === null || to <= from) {
				return json({ error: "invalid time range" }, 400);
			}
			try {
				const [total, series] = await Promise.all([
					queryAnalytics(queryEnv, totalEvents({ from, to })),
					queryAnalytics(queryEnv, eventsOverTime({ from, to }, "day")),
				]);
				return json({
					total: Number(total.data[0]?.events ?? 0),
					series: series.data,
				});
			} catch (error) {
				const detail =
					error instanceof QueryError
						? { status: error.status, body: error.body }
						: undefined;
				return json({ error: "query failed", detail }, 500);
			}
		}

		const siteId = url.searchParams.get("siteId");
		if (!isValidSiteId(siteId)) {
			return json({ error: "invalid siteId" }, 400);
		}

		if (url.pathname === "/api/realtime") {
			const to = Date.now();
			const from = to - REALTIME_WINDOW_MS;
			try {
				const range: TimeRange = { siteId, from, to };
				const [uniques, pageviews] = await Promise.all([
					queryAnalytics(queryEnv, uniqueVisitors(range)),
					queryAnalytics(queryEnv, totalPageviews(range)),
				]);
				return json({
					windowMs: REALTIME_WINDOW_MS,
					uniques: Number(uniques.data[0]?.uniques ?? 0),
					pageviews: Number(pageviews.data[0]?.pageviews ?? 0),
				});
			} catch (error) {
				const detail =
					error instanceof QueryError
						? { status: error.status, body: error.body }
						: undefined;
				return json({ error: "query failed", detail }, 500);
			}
		}

		const from = parseTimestamp(url.searchParams.get("from"));
		const to = parseTimestamp(url.searchParams.get("to"));
		if (from === null || to === null || to <= from) {
			return json({ error: "invalid time range" }, 400);
		}

		try {
			switch (url.pathname) {
				case "/api/pageviews": {
					const rawBucket = url.searchParams.get("bucket");
					if (
						rawBucket !== null &&
						rawBucket !== "hour" &&
						rawBucket !== "day"
					) {
						return json({ error: "invalid bucket" }, 400);
					}
					const bucketValue: TimeBucket = rawBucket ?? "day";
					const series = await queryAnalytics(
						queryEnv,
						pageviewsOverTime({ siteId, from, to }, bucketValue),
					);
					const total = await queryAnalytics(
						queryEnv,
						totalPageviews({ siteId, from, to }),
					);
					return json({
						series: series.data,
						total: Number(total.data[0]?.pageviews ?? 0),
					});
				}
				case "/api/uniques": {
					const result = await queryAnalytics(
						queryEnv,
						uniqueVisitors({ siteId, from, to }),
					);
					return json({
						uniques: Number(result.data[0]?.uniques ?? 0),
					});
				}
				case "/api/breakdown": {
					const range: TimeRange = { siteId, from, to };
					const [pages, referrers, browsers, oses, devices, countries, bounce] =
						await Promise.all([
							queryAnalytics(queryEnv, topPages(range)),
							queryAnalytics(queryEnv, topReferrers(range)),
							queryAnalytics(queryEnv, breakdown(range, "browser")),
							queryAnalytics(queryEnv, breakdown(range, "os")),
							queryAnalytics(queryEnv, breakdown(range, "deviceType")),
							queryAnalytics(queryEnv, breakdown(range, "country")),
							queryAnalytics(queryEnv, bounceRate(range)),
						]);
					const bounceRow = bounce.data[0] as
						| {
								bounces?: string | number | null;
								visitors?: string | number | null;
						  }
						| undefined;
					const visitors = Number(bounceRow?.visitors ?? 0);
					const bounces = Number(bounceRow?.bounces ?? 0);
					return json({
						pages: breakdownRows(pages.data),
						referrers: breakdownRows(referrers.data),
						browsers: breakdownRows(browsers.data),
						oses: breakdownRows(oses.data),
						devices: breakdownRows(devices.data),
						countries: breakdownRows(countries.data),
						bounce: {
							bounces,
							visitors,
							rate: visitors > 0 ? bounces / visitors : 0,
						},
					});
				}
				default:
					return json({ error: "not found" }, 404);
			}
		} catch (error) {
			const detail =
				error instanceof QueryError
					? { status: error.status, body: error.body }
					: undefined;
			return json({ error: "query failed", detail }, 500);
		}
	},
} satisfies ExportedHandler<Cloudflare.Env>;
