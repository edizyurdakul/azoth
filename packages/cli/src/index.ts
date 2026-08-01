#!/usr/bin/env bun
import chalk from "chalk";
import yargs from "yargs";
import { doctorExitCode, runDoctor } from "./commands/doctor";
import { runInstall } from "./commands/install";
import { runStatus } from "./commands/status";
import { CloudflareClient } from "./lib/cloudflare";

interface CommonOptions {
	verbose?: boolean;
	json?: boolean;
	yes?: boolean;
	dryRun?: boolean;
	accountId?: string;
	authSecret?: string;
	apiToken?: string;
}

function makeClient(): CloudflareClient {
	return new CloudflareClient();
}

export async function main(argv: string[]): Promise<void> {
	const parser = yargs(argv)
		.scriptName("azoth")
		.usage("$0 <command> [options]")
		.option("verbose", {
			type: "boolean",
			description: "Print extra detail (wrangler output, etc.)",
			global: true,
		})
		.option("json", {
			type: "boolean",
			description: "Machine-readable JSON output",
			global: true,
		})
		.command<CommonOptions>(
			"install",
			"Deploy Azoth to Cloudflare (one-command onboarding)",
			(yargs) =>
				yargs
					.option("yes", {
						type: "boolean",
						description: "Non-interactive; use flags/env for all inputs",
					})
					.option("dry-run", {
						type: "boolean",
						description: "Show what would change without writing/deploying",
					})
					.option("account-id", {
						type: "string",
						description: "Cloudflare account id (skips account selection)",
					})
					.option("auth-secret", {
						type: "string",
						description: "Provide AUTH_SECRET instead of generating one",
					})
					.option("api-token", {
						type: "string",
						description: "Provide CF_API_TOKEN instead of prompting",
					}),
			async (argv) => {
				await runInstall(makeClient(), {
					yes: argv.yes,
					dryRun: argv.dryRun,
					accountId: argv.accountId,
					authSecret: argv.authSecret,
					apiToken: argv.apiToken,
					verbose: argv.verbose,
				});
			},
		)
		.command<CommonOptions>(
			"doctor",
			"Run pre-deploy diagnostics",
			() => {},
			async (argv) => {
				const report = await runDoctor({
					cloudflare: makeClient(),
					json: argv.json,
					verbose: argv.verbose,
				});
				process.exitCode = doctorExitCode(report);
			},
		)
		.command<CommonOptions>(
			"status",
			"Show account, workers, secrets, and last deploy",
			() => {},
			async (argv) => {
				await runStatus({ cloudflare: makeClient(), json: argv.json });
			},
		)
		.demandCommand(1, "run `azoth --help` to see commands")
		.recommendCommands()
		.fail((message, error, yargsInstance) => {
			console.error(chalk.red(message));
			if (error !== undefined) {
				console.error(error.message);
			}
			console.error(yargsInstance.help());
			process.exit(1);
		});

	await parser.parse();
}

if (process.argv[1] !== undefined && import.meta.path === process.argv[1]) {
	await main(process.argv.slice(2));
}
