import chalk from "chalk";
import { generateAuthSecret } from "../lib/auth";
import type { Account, CloudflareClient } from "../lib/cloudflare";
import {
	currentCommit,
	DASHBOARD_CONFIG,
	INGESTION_CONFIG,
	readWranglerConfig,
	type WranglerConfig,
	writeState,
	writeWranglerConfig,
} from "../lib/config";
import {
	checkHealth,
	type HealthCheck,
	type HealthTargets,
} from "../lib/health";
import {
	confirmStep,
	intro,
	note,
	outro,
	passwordStep,
	selectStep,
} from "../lib/prompts";
import { embedSnippet, testCurl } from "../lib/snippet";

const CLI_VERSION = "0.1.0";

export interface InstallOptions {
	yes?: boolean;
	dryRun?: boolean;
	accountId?: string;
	authSecret?: string;
	apiToken?: string;
	verbose?: boolean;
	checkHealth?: (targets: HealthTargets) => Promise<HealthCheck[]>;
}

export interface InstallResult {
	deployed: boolean;
	account?: Account;
	ingestionUrl?: string;
	dashboardUrl?: string;
	skipped: string[];
}

async function resolveAccount(
	cloudflare: CloudflareClient,
	opts: InstallOptions,
): Promise<Account | undefined> {
	const whoami = await cloudflare.whoami();
	if (!whoami.loggedIn) {
		if (opts.verbose) {
			console.log(chalk.dim("wrangler whoami: not logged in"));
		}
		return undefined;
	}
	if (opts.accountId !== undefined) {
		const match = whoami.accounts.find((a) => a.id === opts.accountId);
		if (match !== undefined) {
			return match;
		}
		if (opts.verbose) {
			console.log(
				chalk.yellow(`account ${opts.accountId} not found in whoami`),
			);
		}
	}
	if (whoami.accounts.length === 1) {
		return whoami.accounts[0];
	}
	if (whoami.accounts.length === 0) {
		return undefined;
	}
	if (opts.yes === true) {
		return whoami.accounts[0];
	}
	return selectStep(
		"Which Cloudflare account?",
		whoami.accounts.map((a) => ({ value: a.id, label: a.name ?? a.id })),
	).then((id) => whoami.accounts.find((a) => a.id === id));
}

function patchAccount(
	config: WranglerConfig,
	accountId: string,
	withVars: boolean,
): WranglerConfig {
	const next = { ...config };
	next.account_id = accountId;
	if (withVars) {
		next.vars = { ...(next.vars ?? {}), CF_ACCOUNT_ID: accountId };
	}
	return next;
}

const SITES_KV_BINDING = "SITES";

function patchSitesKv(
	config: WranglerConfig,
	namespaceId: string,
): WranglerConfig {
	const next = { ...config };
	const bindings = (next.kv_namespaces ?? []).filter(
		(b) => b.binding !== SITES_KV_BINDING,
	);
	bindings.push({ binding: SITES_KV_BINDING, id: namespaceId });
	next.kv_namespaces = bindings;
	return next;
}

function patchIngestionUrl(
	config: WranglerConfig,
	ingestionUrl: string,
): WranglerConfig {
	const next = { ...config };
	next.vars = { ...(next.vars ?? {}), INGESTION_URL: ingestionUrl };
	return next;
}

function hasSitesKv(config: WranglerConfig): boolean {
	return (
		(config.kv_namespaces ?? []).some(
			(b) => b.binding === SITES_KV_BINDING && b.id !== "",
		) ?? false
	);
}

async function ensureSitesKv(
	cloudflare: CloudflareClient,
	config: WranglerConfig,
	opts: InstallOptions,
): Promise<{ ok: boolean; id?: string; output: string }> {
	if (hasSitesKv(config)) {
		const existing = (config.kv_namespaces ?? []).find(
			(b) => b.binding === SITES_KV_BINDING,
		);
		return {
			ok: true,
			id: existing?.id,
			output: "SITES KV binding already set",
		};
	}
	const created = await cloudflare.createKvNamespace(SITES_KV_BINDING);
	if (opts.verbose && !created.ok) {
		console.log(chalk.yellow(created.output.trim()));
	}
	return created;
}

async function resolveApiToken(
	cloudflare: CloudflareClient,
	opts: InstallOptions,
): Promise<string | undefined> {
	const fromEnv = process.env.CF_API_TOKEN;
	const candidate = opts.apiToken ?? fromEnv;
	if (candidate !== undefined && candidate !== "") {
		const verified = await cloudflare.verifyToken(candidate);
		if (opts.verbose && !verified.ok) {
			console.log(chalk.yellow("CF_API_TOKEN could not be verified"));
		}
		if (verified.ok || opts.yes === true) {
			return candidate;
		}
	}
	if (opts.yes === true) {
		return undefined;
	}
	return passwordStep(
		"Paste your Cloudflare API token (workers_scripts:write + account read)",
	);
}

export async function runInstall(
	cloudflare: CloudflareClient,
	opts: InstallOptions,
): Promise<InstallResult> {
	intro(chalk.bold("Azoth install"));

	const result: InstallResult = { deployed: false, skipped: [] };

	if (opts.dryRun === true) {
		outro(chalk.dim("dry-run: nothing written or deployed"));
		return result;
	}

	const account = await resolveAccount(cloudflare, opts);
	if (account === undefined) {
		outro(
			chalk.red(
				"No Cloudflare account found. Run `wrangler login` first, or pass --account-id.",
			),
		);
		return result;
	}
	result.account = account;

	const dash = readWranglerConfig(DASHBOARD_CONFIG);
	const ing = readWranglerConfig(INGESTION_CONFIG);

	const authSecret = opts.authSecret ?? generateAuthSecret();
	const apiToken = await resolveApiToken(cloudflare, opts);

	if (opts.verbose) {
		console.log(chalk.dim(`account: ${account.name ?? account.id}`));
		console.log(chalk.dim(`dashboard name: ${dash.name ?? "dashboard"}`));
		console.log(chalk.dim(`ingestion name: ${ing.name ?? "ingestion"}`));
	}

	if (opts.yes !== true) {
		const proceed = await confirmStep(
			`Deploy "${dash.name ?? "dashboard"}" and "${ing.name ?? "ingestion"}" to ${account.name ?? account.id}?`,
		);
		if (!proceed) {
			outro("Cancelled");
			return result;
		}
	}

	const kv = await ensureSitesKv(cloudflare, dash, opts);
	if (!kv.ok || kv.id === undefined) {
		result.skipped.push(
			"SITES KV namespace (create failed, run azoth install again)",
		);
	}

	const patchedDash = patchSitesKv(
		patchAccount(dash, account.id, true),
		kv.id ?? "",
	);
	const patchedIng = patchAccount(ing, account.id, false);
	writeWranglerConfig(DASHBOARD_CONFIG, patchedDash);
	writeWranglerConfig(INGESTION_CONFIG, patchedIng);
	if (opts.verbose) {
		console.log(
			chalk.dim(
				"patched account_id + SITES KV binding into wrangler.toml files",
			),
		);
	}

	const secrets: Record<string, string> = {};
	if (apiToken !== undefined) {
		secrets.CF_API_TOKEN = apiToken;
	}
	secrets.AUTH_SECRET = authSecret;

	if (apiToken !== undefined) {
		const secretResult = await cloudflare.setSecrets(DASHBOARD_CONFIG, {
			CF_API_TOKEN: apiToken,
		});
		if (!secretResult.ok) {
			if (opts.verbose) {
				console.log(chalk.yellow(secretResult.output.trim()));
			}
			result.skipped.push(
				"CF_API_TOKEN (secret bulk failed, run azoth install again)",
			);
		}
	}
	const authResult = await cloudflare.setSecrets(DASHBOARD_CONFIG, {
		AUTH_SECRET: authSecret,
	});
	if (!authResult.ok) {
		if (opts.verbose) {
			console.log(chalk.yellow(authResult.output.trim()));
		}
		result.skipped.push(
			"AUTH_SECRET (secret bulk failed, run azoth install again)",
		);
	}

	note(
		`AUTH_SECRET: ${chalk.bold(authSecret)}\nSave this — you'll need it to log in.`,
		"Generated secret",
	);

	if (opts.yes !== true) {
		const doDeploy = await confirmStep("Deploy the workers now?", true);
		if (!doDeploy) {
			outro("Config written; deploy skipped.");
			return result;
		}
	}

	const ingResult = await cloudflare.deploy(INGESTION_CONFIG);
	result.ingestionUrl = ingResult.url;
	if (ingResult.url === undefined) {
		console.log(
			chalk.yellow("ingestion deploy output (no *.workers.dev URL found):"),
		);
		console.log(ingResult.output.trim());
		result.skipped.push("ingestion deploy");
	} else if (opts.verbose) {
		console.log(chalk.dim(`ingestion: ${ingResult.url}`));
	}

	if (ingResult.url !== undefined) {
		const withUrl = patchIngestionUrl(
			readWranglerConfig(DASHBOARD_CONFIG),
			ingResult.url,
		);
		writeWranglerConfig(DASHBOARD_CONFIG, withUrl);
		if (opts.verbose) {
			console.log(chalk.dim(`patched INGESTION_URL into dashboard config`));
		}
	}

	const dashResult = await cloudflare.deploy(DASHBOARD_CONFIG);
	result.dashboardUrl = dashResult.url;
	if (dashResult.url === undefined) {
		console.log(
			chalk.yellow("dashboard deploy output (no *.workers.dev URL found):"),
		);
		console.log(dashResult.output.trim());
		result.skipped.push("dashboard deploy");
	} else if (opts.verbose) {
		console.log(chalk.dim(`dashboard: ${dashResult.url}`));
	}

	if (
		result.ingestionUrl !== undefined &&
		result.dashboardUrl !== undefined &&
		result.skipped.length === 0
	) {
		const health = opts.checkHealth ?? checkHealth;
		const checks = await health({
			ingestionUrl: result.ingestionUrl,
			dashboardUrl: result.dashboardUrl,
		});
		const failed = checks.filter((c) => !c.ok);
		if (failed.length > 0) {
			for (const c of failed) {
				console.log(
					chalk.yellow(
						`health: ${c.name} expected ${c.expected}, got ${c.actual}`,
					),
				);
			}
			result.skipped.push("health check");
		}
	}

	if (result.ingestionUrl !== undefined && result.dashboardUrl !== undefined) {
		writeState({
			accountId: account.id,
			accountName: account.name,
			ingestionUrl: result.ingestionUrl,
			dashboardUrl: result.dashboardUrl,
			deployedAt: new Date().toISOString(),
			commit: currentCommit() ?? undefined,
			cliVersion: CLI_VERSION,
		});
		result.deployed = true;
	}

	outro(
		result.skipped.length === 0
			? chalk.green("Deployed!")
			: chalk.yellow(
					`Deployed with ${result.skipped.length} step(s) to re-run`,
				),
	);

	if (result.ingestionUrl !== undefined) {
		const snippet = embedSnippet({
			ingestionUrl: result.ingestionUrl,
			dashboardUrl: result.dashboardUrl ?? "",
			siteId: "YOUR_SITE_ID",
		});
		const curl = testCurl({
			ingestionUrl: result.ingestionUrl,
			dashboardUrl: result.dashboardUrl ?? "",
			siteId: "test",
		});
		note(
			`Embed this in your site:\n${snippet}\n\nVerify ingestion:\n${curl}`,
			"Next steps",
		);
	}

	return result;
}
