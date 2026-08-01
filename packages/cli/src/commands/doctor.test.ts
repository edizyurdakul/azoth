import { describe, expect, it, mock } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CloudflareClient } from "../lib/cloudflare";
import { runDoctor } from "./doctor";

const tmp = mkdtempSync(join(tmpdir(), "azoth-cli-doctor-"));
const dashConfig = join(tmp, "dashboard.toml");
const ingConfig = join(tmp, "ingestion.toml");

writeFileSync(
	dashConfig,
	`name = "dashboard"\nmain = "src/index.ts"\ncompatibility_date = "2026-08-01"\nassets = { directory = "./public" }\n\n[[kv_namespaces]]\nbinding = "SITES"\nid = "ffffffffffffffffffffffffffffffff"\n\n[vars]\nCF_ACCOUNT_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"\nINGESTION_URL = "https://ingestion.edizyurdakul.workers.dev"\n`,
);
writeFileSync(
	ingConfig,
	`name = "ingestion"\nmain = "src/index.ts"\ncompatibility_date = "2026-08-01"\nassets = { directory = "./public" }\n\n[[analytics_engine_datasets]]\nbinding = "ANALYTICS"\ndataset = "azoth"\n`,
);

mock.module("../lib/config", () => ({
	...require("../lib/config"),
	DASHBOARD_CONFIG: dashConfig,
	INGESTION_CONFIG: ingConfig,
}));

function fakeClient(stdout: string): CloudflareClient {
	return new CloudflareClient(async () => ({ code: 0, stdout, stderr: "" }));
}

const WHOAMI =
	"You are logged in with an OAuth Token\n┌──────┬──────┐\n│ Account Name │ Account ID │\n├──────┼──────┤\n│ Acme │ aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa │\n└──────┴──────┘";

describe("runDoctor", () => {
	it("passes when everything is healthy", async () => {
		const report = await runDoctor({
			cloudflare: fakeClient(WHOAMI),
			json: false,
		});
		expect(report.ok).toBe(true);
		expect(report.checks.some((c) => c.name === "wrangler login" && c.ok)).toBe(
			true,
		);
	});

	it("flags not-logged-in wrangler", async () => {
		const report = await runDoctor({
			cloudflare: fakeClient(""),
			json: false,
		});
		expect(report.ok).toBe(false);
		const login = report.checks.find((c) => c.name === "wrangler login");
		expect(login?.ok).toBe(false);
	});

	it("emits valid JSON when json is set", async () => {
		const logs = mock((..._args: string[]) => {});
		const original = console.log;
		console.log = logs as unknown as typeof console.log;
		try {
			await runDoctor({ cloudflare: fakeClient(WHOAMI), json: true });
		} finally {
			console.log = original;
		}
		const first = (logs.mock.calls[0]?.[0] ?? "{}") as string;
		const parsed = JSON.parse(first);
		expect(parsed).toHaveProperty("ok");
		expect(parsed).toHaveProperty("checks");
	});
});
