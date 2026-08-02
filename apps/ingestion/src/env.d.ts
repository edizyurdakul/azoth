declare namespace Cloudflare {
	interface Env {
		ANALYTICS: AnalyticsEngineDataset;
		RATE_LIMITER: RateLimit;
	}

	interface GlobalProps {
		mainModule: typeof import("./index");
	}
}
