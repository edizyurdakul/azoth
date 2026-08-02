import { type PageviewEvent, toWriteDataPoint } from "@azoth/schema";
import { parseUa } from "@azoth/ua-parser";
import type { IncomingRequestCfProperties } from "@cloudflare/workers-types";

const SITE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const MAX_PATH_BYTES = 16 * 1024;

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Max-Age": "86400",
};

export function isValidSiteId(siteId: string | null): siteId is string {
	return siteId !== null && SITE_ID_PATTERN.test(siteId);
}

export function isValidPath(path: string): boolean {
	return new TextEncoder().encode(path).byteLength <= MAX_PATH_BYTES;
}

export function reduceReferrer(referrer: string): string {
	if (referrer === "") {
		return "";
	}
	try {
		return new URL(referrer).hostname;
	} catch {
		return "";
	}
}

export function dateSalt(date: Date = new Date()): string {
	return date.toISOString().slice(0, 10);
}

export async function hashVisitor(
	ip: string,
	userAgent: string,
	siteId: string,
	salt: string,
): Promise<string> {
	const data = new TextEncoder().encode(`${ip}${userAgent}${siteId}${salt}`);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return [...new Uint8Array(digest)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export function extractCountry(cf: CfProperties | undefined): string {
	return (cf as IncomingRequestCfProperties | undefined)?.country ?? "";
}

export interface BuildPageviewContext {
	now: () => number;
	salt: string;
}

export async function buildPageview(
	request: Request,
	context: BuildPageviewContext,
): Promise<PageviewEvent | null> {
	const url = new URL(request.url);
	const siteId = url.searchParams.get("siteId");
	if (!isValidSiteId(siteId)) {
		return null;
	}

	const path = url.searchParams.get("path") ?? "/";
	if (!isValidPath(path)) {
		return null;
	}
	const referrer = reduceReferrer(url.searchParams.get("referrer") ?? "");
	const userAgent = request.headers.get("user-agent") ?? "";
	const country = extractCountry(request.cf);
	const ip = request.headers.get("cf-connecting-ip") ?? "";
	const visitorHash = await hashVisitor(ip, userAgent, siteId, context.salt);
	const ua = parseUa(userAgent);

	return {
		siteId,
		path,
		referrer,
		browser: ua.browser,
		browserVersion: ua.browserVersion,
		os: ua.os,
		deviceType: ua.deviceType,
		country,
		visitorHash,
		timestamp: context.now(),
	};
}

export default {
	async fetch(request: Request, env: Cloudflare.Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: CORS_HEADERS });
		}

		if (request.method !== "POST") {
			return new Response("Method Not Allowed", {
				status: 405,
				headers: CORS_HEADERS,
			});
		}

		if (url.pathname !== "/collect") {
			return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
		}

		const siteIdParam = url.searchParams.get("siteId");
		if (siteIdParam !== null) {
			const ip = request.headers.get("cf-connecting-ip") ?? "";
			const { success } = await env.RATE_LIMITER.limit({
				key: `${ip}|${siteIdParam}`,
			});
			if (!success) {
				return new Response("Too Many Requests", {
					status: 429,
					headers: CORS_HEADERS,
				});
			}
		}

		const event = await buildPageview(request, {
			now: Date.now,
			salt: dateSalt(),
		});
		if (event === null) {
			return new Response("Bad Request", {
				status: 400,
				headers: CORS_HEADERS,
			});
		}

		env.ANALYTICS.writeDataPoint(toWriteDataPoint(event));

		return new Response("ok", { status: 200, headers: CORS_HEADERS });
	},
} satisfies ExportedHandler<Cloudflare.Env>;
