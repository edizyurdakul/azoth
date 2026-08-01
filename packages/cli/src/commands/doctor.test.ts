import { describe, expect, it, mock } from "bun:test";
import { CloudflareClient } from "../lib/cloudflare";
import { runDoctor } from "./doctor";

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
