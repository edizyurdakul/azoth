declare namespace Cloudflare {
	interface Env {
		ANALYTICS: AnalyticsEngineDataset;
	}

	interface GlobalProps {
		mainModule: typeof import("./index");
	}
}
