declare namespace Cloudflare {
	interface Env {
		CF_ACCOUNT_ID: string;
		CF_API_TOKEN: string;
		AUTH_SECRET: string;
	}

	interface GlobalProps {
		mainModule: typeof import("./index");
	}
}
