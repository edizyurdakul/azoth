import { describe, expect, it, mock } from "bun:test";
import { CloudflareClient, parseWhoami, type ShellResult } from "./cloudflare";

const WHOAMI_SAMPLE = `
 ⛅️ wrangler 4.118.0
────────────────────
Getting User settings...
👋 You are logged in with an OAuth Token, associated with the email foo@bar.com.
┌──────────────────────────────────┬──────────────────────────────────┐
│ Account Name                     │ Account ID                       │
├──────────────────────────────────┼──────────────────────────────────┤
│ Acme's Account                   │ aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa │
│ Other Account                    │ bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb │
└──────────────────────────────────┴──────────────────────────────────┘
`;

describe("parseWhoami", () => {
	it("parses logged-in state and accounts", () => {
		const result = parseWhoami(WHOAMI_SAMPLE);
		expect(result.loggedIn).toBe(true);
		expect(result.accounts).toHaveLength(2);
		expect(result.accounts[0]).toEqual({
			name: "Acme's Account",
			id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		});
		expect(result.accounts[1]?.id).toBe("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
	});

	it("returns not logged in for empty output", () => {
		const result = parseWhoami("");
		expect(result.loggedIn).toBe(false);
		expect(result.accounts).toHaveLength(0);
	});

	it("falls back to 32-hex regex when table format drifts", () => {
		const raw = "Account ID: c0ffee00000000000000000000000000 (Acme)";
		const result = parseWhoami(raw);
		expect(result.accounts).toContainEqual({
			id: "c0ffee00000000000000000000000000",
			name: "c0ffee00000000000000000000000000",
		});
	});
});

function fakeRun(results: ShellResult[]) {
	let calls = 0;
	return (async () => {
		const r = results[Math.min(calls, results.length - 1)] as ShellResult;
		calls += 1;
		return r;
	}) as (cmd: string[], opts?: { cwd?: string }) => Promise<ShellResult>;
}

describe("CloudflareClient", () => {
	it("whoami delegates to the shell runner", async () => {
		const client = new CloudflareClient(
			fakeRun([{ code: 0, stdout: WHOAMI_SAMPLE, stderr: "" }]),
		);
		const result = await client.whoami();
		expect(result.accounts[0]?.id).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
	});

	it("deploy parses the workers.dev URL from output", async () => {
		const client = new CloudflareClient(
			fakeRun([
				{
					code: 0,
					stdout:
						"Uploaded dashboard (1.2s)\nhttps://dashboard.example.workers.dev\n",
					stderr: "",
				},
			]),
		);
		const result = await client.deploy("/tmp/x/wrangler.toml");
		expect(result.url).toBe("https://dashboard.example.workers.dev");
	});

	it("deploy returns undefined URL when output has none", async () => {
		const client = new CloudflareClient(
			fakeRun([{ code: 0, stdout: "Uploaded dashboard\n", stderr: "" }]),
		);
		const result = await client.deploy("/tmp/x/wrangler.toml");
		expect(result.url).toBeUndefined();
	});

	it("setSecrets writes a temp file and cleans up", async () => {
		const seen = mock((_cmd: string[], _opts?: { cwd?: string }) => ({
			code: 0,
			stdout: "ok",
			stderr: "",
		}));
		const client = new CloudflareClient(
			seen as unknown as (
				cmd: string[],
				opts?: { cwd?: string },
			) => Promise<ShellResult>,
		);
		const result = await client.setSecrets("/tmp/x/wrangler.toml", {
			AUTH_SECRET: "s3cret",
		});
		expect(result.ok).toBe(true);
		const [cmd] = seen.mock.calls[0] as [
			string[],
			{ cwd?: string } | undefined,
		];
		expect(cmd).toContain("secret");
		expect(cmd).toContain("bulk");
		const tmpPath = cmd[cmd.length - 1] as string;
		expect(tmpPath).toStartWith("/tmp/azoth-secrets-");
		// temp file must be removed
		const exists = await Bun.file(tmpPath).exists();
		expect(exists).toBe(false);
	});
});
