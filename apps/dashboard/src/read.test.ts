// Read-path tests run under Vitest with @cloudflare/vitest-pool-workers
// (workerd semantics) — see apps/dashboard/vitest.config.ts.
import { eventsToIpc, type StoredEvent } from "@azoth/storage";
import { afterEach, describe, expect, test, vi } from "vitest";
import { readBreakdown, readPageviews, readUniques, storageKey } from "./read";
import { makeMockR2 } from "./test/r2";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-08-02T00:00:00Z");
const BOUNDARY = NOW - 89 * DAY_MS;

const queryEnv = { CF_ACCOUNT_ID: "acc-1", CF_API_TOKEN: "token-1" };

function archivedEvent(
	timestamp: number,
	overrides: Partial<StoredEvent> = {},
): StoredEvent {
	return {
		siteId: "site-1",
		path: "/archived",
		referrer: "",
		browser: "Chrome",
		browserVersion: "126.0",
		os: "macOS",
		deviceType: "desktop",
		country: "US",
		visitorHash: "hash-archived",
		timestamp,
		sampleInterval: 1,
		...overrides,
	};
}

function seedDay(
	r2: ReturnType<typeof makeMockR2>,
	day: string,
	events: StoredEvent[],
) {
	r2.store.set(storageKey("site-1", day), eventsToIpc(events, 1));
}

function stubAe(respond: (sql: string) => unknown[]) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
			const sql = String(init?.body ?? "");
			const data = respond(sql);
			return new Response(JSON.stringify({ data, rows: data.length }), {
				status: 200,
			});
		}),
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("read path", () => {
	test("readPageviews reads only from AE for a recent range", async () => {
		const r2 = makeMockR2();
		const getSpy = vi.spyOn(r2, "get");
		stubAe((sql) => {
			if (sql.includes("GROUP BY t")) {
				return [{ t: "2026-07-01 00:00:00", pageviews: "3" }];
			}
			return [{ pageviews: "3" }];
		});

		const result = await readPageviews(
			{ queryEnv, STORAGE: r2 },
			{ siteId: "site-1", from: Date.parse("2026-07-01T00:00:00Z"), to: NOW },
			"day",
			NOW,
		);

		expect(result).toEqual({
			series: [{ t: "2026-07-01 00:00:00", pageviews: "3" }],
			total: 3,
		});
		expect(getSpy).not.toHaveBeenCalled();
	});

	test("readPageviews reads only from R2 for a fully-archived range", async () => {
		const r2 = makeMockR2();
		seedDay(r2, "2026-05-03", [
			archivedEvent(Date.parse("2026-05-03T10:00:00Z"), { path: "/a" }),
			archivedEvent(Date.parse("2026-05-03T11:00:00Z"), { path: "/b" }),
		]);
		const fetchSpy = vi.fn(async () => new Response("{}", { status: 500 }));
		vi.stubGlobal("fetch", fetchSpy);

		const result = await readPageviews(
			{ queryEnv, STORAGE: r2 },
			{
				siteId: "site-1",
				from: Date.parse("2026-05-03T00:00:00Z"),
				to: BOUNDARY,
			},
			"day",
			NOW,
		);

		expect(result).toEqual({
			series: [{ t: "2026-05-03 00:00:00", pageviews: "2" }],
			total: 2,
		});
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	test("readPageviews merges AE and R2 series across the boundary", async () => {
		const r2 = makeMockR2();
		seedDay(r2, "2026-05-03", [
			archivedEvent(Date.parse("2026-05-03T10:00:00Z")),
			archivedEvent(Date.parse("2026-05-03T11:00:00Z")),
		]);
		stubAe((sql) => {
			if (sql.includes("GROUP BY t")) {
				return [{ t: "2026-07-01 00:00:00", pageviews: "3" }];
			}
			return [{ pageviews: "3" }];
		});

		const result = await readPageviews(
			{ queryEnv, STORAGE: r2 },
			{ siteId: "site-1", from: Date.parse("2026-05-03T00:00:00Z"), to: NOW },
			"day",
			NOW,
		);

		expect(result).toEqual({
			series: [
				{ t: "2026-05-03 00:00:00", pageviews: "2" },
				{ t: "2026-07-01 00:00:00", pageviews: "3" },
			],
			total: 5,
		});
	});

	test("readUniques sums AE and R2 unique visitors", async () => {
		const r2 = makeMockR2();
		seedDay(r2, "2026-05-03", [
			archivedEvent(Date.parse("2026-05-03T10:00:00Z"), { visitorHash: "h1" }),
			archivedEvent(Date.parse("2026-05-03T11:00:00Z"), { visitorHash: "h1" }),
			archivedEvent(Date.parse("2026-05-03T12:00:00Z"), { visitorHash: "h2" }),
		]);
		stubAe(() => [{ uniques: "4" }]);

		const result = await readUniques(
			{ queryEnv, STORAGE: r2 },
			{ siteId: "site-1", from: Date.parse("2026-05-03T00:00:00Z"), to: NOW },
			NOW,
		);

		expect(result).toBe(6);
	});

	test("readBreakdown merges top pages and bounce across the boundary", async () => {
		const r2 = makeMockR2();
		seedDay(r2, "2026-05-03", [
			archivedEvent(Date.parse("2026-05-03T10:00:00Z"), {
				path: "/archived",
				browser: "Chrome",
				visitorHash: "h1",
			}),
			archivedEvent(Date.parse("2026-05-03T11:00:00Z"), {
				path: "/archived",
				browser: "Firefox",
				visitorHash: "h2",
			}),
		]);
		stubAe((sql) => {
			if (sql.includes("countIf(cnt = 1)")) {
				return [{ bounces: "1", visitors: "3" }];
			}
			return [{ name: "/live", pageviews: "5" }];
		});

		const result = await readBreakdown(
			{ queryEnv, STORAGE: r2 },
			{ siteId: "site-1", from: Date.parse("2026-05-03T00:00:00Z"), to: NOW },
			10,
			NOW,
		);

		expect(result.pages).toEqual([
			{ name: "/live", pageviews: "5" },
			{ name: "/archived", pageviews: "2" },
		]);
		expect(result.browsers).toContainEqual({ name: "Chrome", pageviews: "1" });
		expect(result.bounce).toEqual({ bounces: 3, visitors: 5 });
	});
});
