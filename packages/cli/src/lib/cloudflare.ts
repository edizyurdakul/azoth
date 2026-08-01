import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "bun";
import { REPO_ROOT } from "./config";

export interface ShellResult {
	code: number;
	stdout: string;
	stderr: string;
}

export type ShellRunner = (
	cmd: string[],
	opts?: { cwd?: string },
) => Promise<ShellResult>;

export async function bunShell(
	cmd: string[],
	opts?: { cwd?: string },
): Promise<ShellResult> {
	const result = await $`${cmd}`
		.cwd(opts?.cwd ?? REPO_ROOT)
		.quiet()
		.nothrow();
	const stdout = await result.text();
	return {
		code: result.exitCode,
		stdout,
		stderr: result.stderr.toString(),
	};
}

export interface Account {
	id: string;
	name: string;
}

export interface WranglerWhoami {
	loggedIn: boolean;
	email?: string;
	accounts: Account[];
}

export function parseWhoami(raw: string): WranglerWhoami {
	const accounts: Account[] = [];
	const idRe = /([a-f0-9]{32})/i;
	for (const line of raw.split("\n")) {
		if (line.includes("│")) {
			const cells = line
				.split("│")
				.map((c) => c.trim())
				.filter((c) => c !== "" && c !== "Account Name" && c !== "Account ID");
			if (cells.length < 2) {
				continue;
			}
			const idCell = cells.find((c) => idRe.test(c));
			if (idCell === undefined) {
				continue;
			}
			const id = (idCell.match(idRe) ?? [""])[0] as string;
			const name = cells.find((c) => c !== idCell) ?? idCell;
			accounts.push({ id, name });
		} else if (line.includes("Account ID")) {
			const id = (line.match(idRe) ?? [""])[0] as string;
			if (id !== "") {
				accounts.push({ id, name: id });
			}
		}
	}
	return {
		loggedIn: raw.includes("You are logged in"),
		email: raw.match(/email ([^ .]+)/)?.[1],
		accounts,
	};
}

export class CloudflareClient {
	constructor(
		private readonly run: ShellRunner = bunShell,
		private readonly wranglerBin?: string,
	) {}

	async whoami(): Promise<WranglerWhoami> {
		const result = await this.run(this.wranglerArgs("whoami"));
		return parseWhoami(result.stdout);
	}

	async verifyToken(
		token: string,
	): Promise<{ ok: boolean; id?: string; status?: string }> {
		const response = await fetch(
			"https://api.cloudflare.com/client/v4/user/tokens/verify",
			{
				method: "GET",
				headers: { Authorization: `Bearer ${token}` },
			},
		);
		const body = (await response.json().catch(() => ({}))) as {
			result?: { id?: string; status?: string };
		};
		return {
			ok: response.ok && (body.result?.status ?? "active") === "active",
			id: body.result?.id,
			status: body.result?.status,
		};
	}

	async deploy(configPath: string): Promise<{ url?: string; output: string }> {
		const result = await this.run([
			...this.wranglerArgs("deploy"),
			"--config",
			configPath,
		]);
		const url = result.stdout.match(
			/https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.workers\.dev/,
		)?.[0];
		return { url, output: result.stdout };
	}

	async setSecrets(
		configPath: string,
		secrets: Record<string, string>,
	): Promise<{ ok: boolean; output: string }> {
		const path = `/tmp/azoth-secrets-${crypto.randomUUID()}.json`;
		await Bun.write(path, JSON.stringify(secrets, null, 2));
		const result = await this.run([
			...this.wranglerArgs("secret", "bulk"),
			"--config",
			configPath,
			path,
		]);
		await Bun.file(path)
			.unlink()
			.catch(() => {});
		return { ok: result.code === 0, output: result.stdout };
	}

	private wranglerArgs(...args: string[]): string[] {
		const bin =
			this.wranglerBin ??
			join(
				fileURLToPath(import.meta.resolve("wrangler/package.json")),
				"..",
				"bin",
				"wrangler.js",
			);
		return [bin, ...args];
	}
}
