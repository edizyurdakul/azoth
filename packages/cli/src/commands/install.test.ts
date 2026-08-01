import { beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "azoth-cli-test-"));
const dashConfig = join(tmp, "dashboard.toml");
const ingConfig = join(tmp, "ingestion.toml");
const stateFile = join(tmp, "state.json");

function writeFixtures() {
	writeFileSync(
		dashConfig,
		`name = "dashboard"\nmain = "src/index.ts"\ncompatibility_date = "2026-08-01"\nassets = { directory = "./public" }\n\n[vars]\nCF_ACCOUNT_ID = ""\n`,
	);
	writeFileSync(
		ingConfig,
		`name = "ingestion"\nmain = "src/index.ts"\ncompatibility_date = "2026-08-01"\nassets = { directory = "./public" }\n\n[[analytics_engine_datasets]]\nbinding = "ANALYTICS"\ndataset = "azoth"\n`,
	);
}
writeFixtures();

mock.module("../lib/config", () => ({
	...require("../lib/config"),
	DASHBOARD_CONFIG: dashConfig,
	INGESTION_CONFIG: ingConfig,
	STATE_FILE: stateFile,
	REPO_ROOT: tmp,
}));

mock.module("../lib/prompts", () => ({
	...require("../lib/prompts"),
}));

import { CloudflareClient } from "../lib/cloudflare";
import { runInstall } from "./install";

const WHOAMI =
	"You are logged in with an OAuth Token\n┌──────┬──────┐\n│ Account Name │ Account ID │\n├──────┼──────┤\n│ Acme │ aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa │\n└──────┴──────┘";

function fakeClient() {
	const calls: string[][] = [];
	const run = mock(async (cmd: string[]) => {
		calls.push(cmd);
		if (cmd.includes("whoami")) {
			return { code: 0, stdout: WHOAMI, stderr: "" };
		}
		if (cmd.includes("deploy")) {
			const name =
				cmd[cmd.length - 2] === "--config" ? cmd[cmd.length - 1] : "?";
			const url = (name ?? "").includes("ingestion")
				? "https://ingestion.edizyurdakul.workers.dev"
				: "https://dashboard.edizyurdakul.workers.dev";
			return {
				code: 0,
				stdout: `Uploaded\n${url}\n`,
				stderr: "",
			};
		}
		if (cmd.includes("kv") && cmd.includes("namespace")) {
			return {
				code: 0,
				stdout: `📦 Created namespace with ID "ffffffffffffffffffffffffffffffff"`,
				stderr: "",
			};
		}
		return { code: 0, stdout: "ok", stderr: "" };
	});
	return { client: new CloudflareClient(run), calls };
}

describe("runInstall", () => {
	beforeEach(() => {
		mock.restore();
		writeFixtures();
	});

	function opts(secret: string): Parameters<typeof runInstall>[1] {
		return {
			yes: true,
			authSecret: secret,
			apiToken: "tok",
			checkHealth: async () => [],
		};
	}

	it("dry-run writes and deploys nothing", async () => {
		const { client } = fakeClient();
		const result = await runInstall(client, {
			...opts("a".repeat(64)),
			dryRun: true,
		});
		expect(result.deployed).toBe(false);
		const read = (await Bun.file(dashConfig).text()) as string;
		expect(read).not.toContain("account_id");
	});

	it("runs to completion non-interactively", async () => {
		const { client } = fakeClient();
		const result = await runInstall(client, opts("b".repeat(64)));
		expect(result.deployed).toBe(true);
		expect(result.ingestionUrl).toBe(
			"https://ingestion.edizyurdakul.workers.dev",
		);
		expect(result.dashboardUrl).toBe(
			"https://dashboard.edizyurdakul.workers.dev",
		);
		const state = JSON.parse(await Bun.file(stateFile).text()) as {
			accountId?: string;
		};
		expect(state.accountId).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
	});

	it("patches account_id into both configs", async () => {
		const { client } = fakeClient();
		await runInstall(client, opts("c".repeat(64)));
		expect((await Bun.file(dashConfig).text()) as string).toContain(
			'account_id = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
		);
		expect((await Bun.file(ingConfig).text()) as string).toContain(
			'account_id = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
		);
	});

	it("creates the SITES KV namespace and binds it in the dashboard config", async () => {
		const { client, calls } = fakeClient();
		await runInstall(client, opts("d".repeat(64)));
		expect(
			calls.some((cmd) => cmd.includes("kv") && cmd.includes("namespace")),
		).toBe(true);
		const dash = (await Bun.file(dashConfig).text()) as string;
		expect(dash).toContain('binding = "SITES"');
		expect(dash).toContain('id = "ffffffffffffffffffffffffffffffff"');
	});

	it("patches INGESTION_URL into the dashboard config before deploy", async () => {
		const { client } = fakeClient();
		await runInstall(client, opts("e".repeat(64)));
		const dash = (await Bun.file(dashConfig).text()) as string;
		expect(dash).toContain(
			'INGESTION_URL = "https://ingestion.edizyurdakul.workers.dev"',
		);
	});
});
