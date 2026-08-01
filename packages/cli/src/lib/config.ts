import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "smol-toml";

export interface WranglerConfig {
	name?: string;
	main?: string;
	compatibility_date?: string;
	assets?: Record<string, string>;
	vars?: Record<string, string>;
	account_id?: string;
	analytics_engine_datasets?: Array<Record<string, string>>;
	kv_namespaces?: Array<{ binding: string; id: string }>;
	[key: string]: unknown;
}

export interface AzothState {
	accountId?: string;
	accountName?: string;
	ingestionUrl?: string;
	dashboardUrl?: string;
	deployedAt?: string;
	commit?: string;
	cliVersion?: string;
}

const HERE = dirname(fileURLToPath(import.meta.url));

function findRepoRoot(): string {
	let dir = resolve(HERE, "../../..");
	while (true) {
		const pkg = join(dir, "package.json");
		if (existsSync(pkg)) {
			const raw = readFileSync(pkg, "utf8");
			const json = JSON.parse(raw) as { workspaces?: unknown };
			if (Array.isArray(json.workspaces)) {
				return dir;
			}
		}
		const parent = dirname(dir);
		if (parent === dir) {
			throw new Error(
				"azoth repo root not found (looking for a package.json with workspaces)",
			);
		}
		dir = parent;
	}
}

export const REPO_ROOT = findRepoRoot();

export const DASHBOARD_CONFIG = join(REPO_ROOT, "apps/dashboard/wrangler.toml");
export const INGESTION_CONFIG = join(REPO_ROOT, "apps/ingestion/wrangler.toml");
export const STATE_FILE = join(REPO_ROOT, ".azoth/state.json");
export const STATE_DIR = dirname(STATE_FILE);

export function readWranglerConfig(path: string): WranglerConfig {
	return parse(readFileSync(path, "utf8")) as WranglerConfig;
}

export function writeWranglerConfig(
	path: string,
	config: WranglerConfig,
): void {
	writeFileSync(path, stringify(config));
}

export function readState(): AzothState {
	if (!existsSync(STATE_FILE)) {
		return {};
	}
	try {
		return JSON.parse(readFileSync(STATE_FILE, "utf8")) as AzothState;
	} catch {
		return {};
	}
}

export function writeState(state: AzothState): void {
	if (!existsSync(STATE_DIR)) {
		mkdirSync(STATE_DIR, { recursive: true });
	}
	writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

export function currentCommit(): string | null {
	try {
		return execSync("git rev-parse --short HEAD", {
			cwd: REPO_ROOT,
			stdio: ["ignore", "pipe", "ignore"],
		})
			.toString()
			.trim();
	} catch {
		return null;
	}
}
