export interface HealthCheck {
	name: string;
	url: string;
	expected: number;
	actual: number | "error";
	ok: boolean;
}

export async function checkUrl(
	name: string,
	url: string,
	expected: number,
): Promise<HealthCheck> {
	try {
		const response = await fetch(url);
		return {
			name,
			url,
			expected,
			actual: response.status,
			ok: response.status === expected,
		};
	} catch {
		return { name, url, expected, actual: "error", ok: false };
	}
}

export interface HealthTargets {
	ingestionUrl: string;
	dashboardUrl: string;
}

export async function checkHealth(
	targets: HealthTargets,
	timeoutMs = 10_000,
): Promise<HealthCheck[]> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const checks = await Promise.all([
			// Non-POST to /collect returns 405 ("Method Not Allowed") → worker is up.
			checkUrl("ingestion /collect", `${targets.ingestionUrl}/collect`, 405),
			// Dashboard is behind the auth gate: /api/uniques without a token → 401.
			checkUrl(
				"dashboard /api/uniques",
				`${targets.dashboardUrl}/api/uniques`,
				401,
			),
			// Tracker asset must be served as a static asset.
			checkUrl("tracker.min.js", `${targets.ingestionUrl}/tracker.min.js`, 200),
		]);
		return checks;
	} finally {
		clearTimeout(timer);
	}
}
