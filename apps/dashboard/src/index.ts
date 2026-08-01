import { isAuthorized } from "./auth";
import {
	pageviewsOverTime,
	type TimeBucket,
	totalPageviews,
	uniqueVisitors,
} from "./queries";
import { type QueryEnv, QueryError, queryAnalytics } from "./query";

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

export default {
	async fetch(request: Request, env: Cloudflare.Env): Promise<Response> {
		if (!isAuthorized(request, env)) {
			return json({ error: "unauthorized" }, 401);
		}

		const url = new URL(request.url);
		if (request.method !== "GET") {
			return json({ error: "method not allowed" }, 405);
		}

		const siteId = url.searchParams.get("siteId");
		if (!isValidSiteId(siteId)) {
			return json({ error: "invalid siteId" }, 400);
		}

		const from = parseTimestamp(url.searchParams.get("from"));
		const to = parseTimestamp(url.searchParams.get("to"));
		if (from === null || to === null || to <= from) {
			return json({ error: "invalid time range" }, 400);
		}

		const queryEnv: QueryEnv = {
			CF_ACCOUNT_ID: env.CF_ACCOUNT_ID,
			CF_API_TOKEN: env.CF_API_TOKEN,
		};

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
