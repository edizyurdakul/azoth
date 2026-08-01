import chalk from "chalk";
import type {
	Account,
	CloudflareClient,
	WranglerWhoami,
} from "../lib/cloudflare";
import {
	DASHBOARD_CONFIG,
	INGESTION_CONFIG,
	readState,
	readWranglerConfig,
} from "../lib/config";
import { checkHealth } from "../lib/health";

export interface DoctorReport {
	ok: boolean;
	checks: Array<{
		name: string;
		ok: boolean;
		detail?: string;
	}>;
}

function check(
	report: DoctorReport,
	name: string,
	ok: boolean,
	detail?: string,
): void {
	report.checks.push({ name, ok, detail });
	if (!ok) {
		report.ok = false;
	}
}

export async function runDoctor(args: {
	cloudflare: CloudflareClient;
	json?: boolean;
	verbose?: boolean;
}): Promise<DoctorReport> {
	const report: DoctorReport = { ok: true, checks: [] };

	let whoami: WranglerWhoami | undefined;
	try {
		whoami = await args.cloudflare.whoami();
		check(
			report,
			"wrangler login",
			whoami.loggedIn,
			whoami.loggedIn
				? undefined
				: "run `wrangler login` (or set CLOUDFLARE_API_TOKEN) first",
		);
		if (whoami.loggedIn && whoami.accounts.length === 0) {
			check(
				report,
				"cloudflare accounts",
				false,
				"no accounts found for this token",
			);
		}
	} catch (error) {
		check(report, "wrangler login", false, String(error));
	}

	for (const [name, path] of [
		["dashboard config", DASHBOARD_CONFIG],
		["ingestion config", INGESTION_CONFIG],
	] as const) {
		try {
			const config = readWranglerConfig(path);
			check(report, `${name} parses`, true);
			if (name === "dashboard config") {
				if (
					config.vars?.CF_ACCOUNT_ID === undefined ||
					config.vars.CF_ACCOUNT_ID === ""
				) {
					check(
						report,
						"CF_ACCOUNT_ID var",
						false,
						"run `azoth install` to set it",
					);
				}
			}
			if (name === "ingestion config") {
				const hasAe =
					config.analytics_engine_datasets?.some(
						(ds) => ds.binding === "ANALYTICS",
					) ?? false;
				check(
					report,
					"ANALYTICS binding",
					hasAe,
					hasAe
						? undefined
						: "analytics_engine_datasets missing ANALYTICS binding",
				);
			}
		} catch (error) {
			check(report, `${name} parses`, false, String(error));
		}
	}

	const state = readState();
	if (state.dashboardUrl !== undefined && state.ingestionUrl !== undefined) {
		const checks = await checkHealth({
			ingestionUrl: state.ingestionUrl,
			dashboardUrl: state.dashboardUrl,
		});
		for (const c of checks) {
			check(
				report,
				c.name,
				c.ok,
				c.ok ? undefined : `expected ${c.expected}, got ${c.actual} (${c.url})`,
			);
		}
	} else {
		check(
			report,
			"live endpoints",
			true,
			"no prior deploy in .azoth/state.json; health check skipped",
		);
	}

	if (args.json) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		for (const c of report.checks) {
			const icon = c.ok ? chalk.green("✓") : chalk.red("✗");
			const detail = c.detail === undefined ? "" : chalk.dim(` — ${c.detail}`);
			console.log(`${icon} ${c.name}${detail}`);
		}
		if (report.ok) {
			console.log(chalk.green(`\nAll ${report.checks.length} checks passed.`));
		} else {
			console.log(
				chalk.red(
					`\n${report.checks.filter((c) => !c.ok).length} check(s) failed.`,
				),
			);
		}
	}

	return report;
}

export function doctorExitCode(report: DoctorReport): number {
	return report.ok ? 0 : 1;
}

export type { Account };
