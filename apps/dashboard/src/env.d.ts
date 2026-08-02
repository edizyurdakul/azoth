declare namespace Cloudflare {
	interface Env {
		CF_ACCOUNT_ID: string;
		CF_API_TOKEN: string;
		AUTH_SECRET: string;
		SITES: KVNamespace;
		INGESTION_URL?: string;
		RATE_LIMITER: RateLimit;
	}

	interface GlobalProps {
		mainModule: typeof import("./index");
	}
}
