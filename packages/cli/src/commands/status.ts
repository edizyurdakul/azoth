import chalk from "chalk";
import type { CloudflareClient } from "../lib/cloudflare";
import {
	DASHBOARD_CONFIG,
	INGESTION_CONFIG,
	readState,
	readWranglerConfig,
} from "../lib/config";

export interface StatusReport {
	account?: { id?: string; name?: string };
	workers: Array<{ name: string; config: string; deployed: boolean }>;
	kv?: { namespace: string; bound: boolean };
	secrets: Array<{ name: string; set: boolean | "unknown" }>;
	state: {
		ingestionUrl?: string;
		dashboardUrl?: string;
		deployedAt?: string;
		commit?: string;
		cliVersion?: string;
	};
}

export async function runStatus(args: {
	cloudflare: CloudflareClient;
	json?: boolean;
}): Promise<StatusReport> {
	const whoami = await args.cloudflare.whoami();
	const account =
		whoami.accounts[0] === undefined
			? undefined
			: { id: whoami.accounts[0].id, name: whoami.accounts[0].name };

	const workers: StatusReport["workers"] = [];
	const secrets: StatusReport["secrets"] = [];

	const dashConfig = readWranglerConfig(DASHBOARD_CONFIG);
	const ingConfig = readWranglerConfig(INGESTION_CONFIG);

	workers.push({
		name: dashConfig.name ?? "dashboard",
		config: "apps/dashboard/wrangler.toml",
		deployed: dashConfig.account_id !== undefined,
	});
	workers.push({
		name: ingConfig.name ?? "ingestion",
		config: "apps/ingestion/wrangler.toml",
		deployed: ingConfig.account_id !== undefined,
	});

	const sitesKv = (dashConfig.kv_namespaces ?? []).find(
		(b) => b.binding === "SITES",
	);
	const kvBound = sitesKv !== undefined && sitesKv.id !== "";

	secrets.push({ name: "AUTH_SECRET", set: "unknown" });
	secrets.push({ name: "CF_API_TOKEN", set: "unknown" });

	const state = readState();

	const report: StatusReport = {
		account,
		workers,
		kv: { namespace: "SITES", bound: kvBound },
		secrets,
		state,
	};

	if (args.json) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		console.log(chalk.bold("\nAzoth status\n"));
		console.log(
			`account: ${account === undefined ? chalk.dim("not logged in") : `${account.name ?? account.id} (${account.id})`}`,
		);
		console.log(chalk.bold("\nWorkers"));
		for (const w of workers) {
			console.log(
				`  ${w.name} — ${w.config} — ${w.deployed ? chalk.green("configured") : chalk.yellow("not configured")}`,
			);
		}
		console.log(chalk.bold("\nBindings"));
		console.log(
			`  SITES KV — ${kvBound ? chalk.green("bound") : chalk.yellow("not bound (run azoth install)")}`,
		);
		console.log(chalk.bold("\nSecrets"));
		for (const s of secrets) {
			console.log(
				`  ${s.name} — ${s.set === "unknown" ? chalk.dim("unknown (run azoth install)") : s.set ? chalk.green("set") : chalk.red("missing")}`,
			);
		}
		console.log(chalk.bold("\nState"));
		console.log(`  ingestion:  ${state.ingestionUrl ?? chalk.dim("—")}`);
		console.log(`  dashboard:  ${state.dashboardUrl ?? chalk.dim("—")}`);
		console.log(`  deployed:   ${state.deployedAt ?? chalk.dim("—")}`);
		console.log(`  commit:     ${state.commit ?? chalk.dim("—")}`);
		console.log(`  cli:        ${state.cliVersion ?? chalk.dim("—")}`);
	}

	return report;
}
