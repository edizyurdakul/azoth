import { ipcToEvents } from "@azoth/storage";
import { afterEach, describe, expect, test, vi } from "vitest";
import worker from "./index";
import { makeMockR2 } from "./test/r2";

function sampleRow(overrides: Record<string, string | number | null> = {}) {
	return {
		site_id: "site-1",
		blob1: "/",
		blob2: "",
		blob3: "Chrome",
		blob4: "126.0",
		blob5: "macOS",
		blob6: "desktop",
		blob7: "US",
		blob8: "hash1",
		double1: 1722560000000,
		_sample_interval: 1,
		...overrides,
	};
}

function stubHourlyQuery(rowsByHour: (() => unknown[])[]) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
			const sql = String(init?.body ?? "");
			const hourMatch = sql.match(/double1 >= (\d+) AND double1 < (\d+)/);
			const hourStart = Number(hourMatch?.[1] ?? 0);
			const hourIndex = Math.floor((hourStart % 86400000) / 3600000);
			const rows = rowsByHour[hourIndex]?.() ?? [];
			return new Response(JSON.stringify({ data: rows, rows: rows.length }), {
				status: 200,
			});
		}),
	);
}

function stubFetch(fetchImpl: (sql: string) => unknown[]) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
			const sql = String(init?.body ?? "");
			const data = fetchImpl(sql);
			return new Response(JSON.stringify({ data, rows: data.length }), {
				status: 200,
			});
		}),
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("scheduled archive handler", () => {
	test("archives previous UTC day grouped by siteId", async () => {
		const r2 = makeMockR2();
		stubHourlyQuery([
			() => [sampleRow({ blob1: "/a" })],
			() => [],
			() => [sampleRow({ site_id: "site-2", blob1: "/b" })],
		]);

		const env: Cloudflare.Env = {
			CF_ACCOUNT_ID: "acc-1",
			CF_API_TOKEN: "token-1",
			AUTH_SECRET: "super-secret",
			SITES: undefined as never,
			STORAGE: r2,
			STORAGE_ENABLED: "true",
			INGESTION_URL: "https://ingestion.edizyurdakul.workers.dev",
			RATE_LIMITER: undefined as never,
		};
		const controller = {
			cron: "0 2 * * *",
			scheduledTime: Date.now(),
			noRetry: () => {},
		};

		await worker.scheduled(controller, env);

		const keys = [...r2.store.keys()];
		expect(keys.some((k) => k.startsWith("v1/site-1/"))).toBe(true);
		expect(keys.some((k) => k.startsWith("v1/site-2/"))).toBe(true);

		const site1Key = keys.find((k) => k.startsWith("v1/site-1/"));
		const bytes = r2.store.get(site1Key as string);
		const events = ipcToEvents(bytes as Uint8Array);
		expect(events.map((e) => e.path)).toEqual(["/a"]);
	});

	test("writes 24 hourly queries for the previous day", async () => {
		const r2 = makeMockR2();
		const sqls: string[] = [];
		stubFetch((sql) => {
			sqls.push(sql);
			return [sampleRow()];
		});

		const env: Cloudflare.Env = {
			CF_ACCOUNT_ID: "acc-1",
			CF_API_TOKEN: "token-1",
			AUTH_SECRET: "super-secret",
			SITES: undefined as never,
			STORAGE: r2,
			STORAGE_ENABLED: "true",
			INGESTION_URL: "https://ingestion.edizyurdakul.workers.dev",
			RATE_LIMITER: undefined as never,
		};
		const controller = {
			cron: "0 2 * * *",
			scheduledTime: Date.now(),
			noRetry: () => {},
		};

		await worker.scheduled(controller, env);

		expect(sqls).toHaveLength(24);
		for (const sql of sqls) {
			expect(sql).toContain("FROM azoth");
			expect(sql).toMatch(/double1 >= \d+ AND double1 < \d+/);
		}
	});

	test("skips archiving when STORAGE_ENABLED is off", async () => {
		const r2 = makeMockR2();
		const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
		vi.stubGlobal("fetch", fetchSpy);

		const env: Cloudflare.Env = {
			CF_ACCOUNT_ID: "acc-1",
			CF_API_TOKEN: "token-1",
			AUTH_SECRET: "super-secret",
			SITES: undefined as never,
			STORAGE: r2,
			STORAGE_ENABLED: "false",
			INGESTION_URL: "https://ingestion.edizyurdakul.workers.dev",
			RATE_LIMITER: undefined as never,
		};
		const controller = {
			cron: "0 2 * * *",
			scheduledTime: Date.now(),
			noRetry: () => {},
		};

		await worker.scheduled(controller, env);

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(r2.store.size).toBe(0);
	});
});
