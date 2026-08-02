#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "bun";

/**
 * Release automation for Azoth.
 *
 * Derives the next version from Conventional Commits since the last `v*` tag,
 * prepends a CHANGELOG.md section, tags `vX.Y.Z`, and creates a GitHub release
 * titled `Azoth vX.Y.Z`. Triggered by `.github/workflows/release.yml` on push
 * to `main` or manually (workflow_dispatch) with an optional bump override.
 *
 * Env:
 *   GH_TOKEN          — required (workflow provides `secrets.GITHUB_TOKEN`)
 *   GITHUB_REPOSITORY — "owner/repo", used for changelog links
 *   INPUT_BUMP        — auto (default) | major | minor | patch
 */

const REPO = process.env.GITHUB_REPOSITORY ?? "";
const BUMP_OVERRIDE = (process.env.INPUT_BUMP ?? "auto") as
	| "auto"
	| "major"
	| "minor"
	| "patch";

if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
	console.error("GH_TOKEN is required");
	process.exit(1);
}

const SH = { allowFailure: false };

function sh(cmd: string, opts: { allowFailure?: boolean } = SH): string {
	const res = spawnSync(["bash", "-c", cmd]);
	if (res.exitCode !== 0 && !opts.allowFailure) {
		console.error(`command failed (exit ${res.exitCode}): ${cmd}`);
		console.error(res.stderr.toString());
		process.exit(1);
	}
	return res.stdout.toString().trim();
}

const BUMP_ORDER: Record<string, number> = {
	none: 0,
	patch: 1,
	minor: 2,
	major: 3,
};

interface Commit {
	sha: string;
	subject: string;
	body: string;
}

function isBreaking(c: Commit): boolean {
	return /BREAKING(-| )CHANGE:/i.test(c.body) || /!:\s/.test(c.subject);
}

function commitBump(c: Commit): "major" | "minor" | "patch" | "none" {
	if (isBreaking(c)) return "major";
	if (/^feat(\([^)]*\))?:/.test(c.subject)) return "minor";
	if (/^(fix|perf)(\([^)]*\))?:/.test(c.subject)) return "patch";
	return "none";
}

function deriveBump(commits: Commit[]): "major" | "minor" | "patch" | "none" {
	let bump = "none";
	for (const c of commits) {
		const b = commitBump(c);
		if (BUMP_ORDER[b] > BUMP_ORDER[bump]) bump = b;
	}
	return bump;
}

// --- current version from the newest v* tag ---------------------------------
const tags = sh('git tag --list "v*" --sort=-version:refname')
	.split("\n")
	.map((t) => t.trim())
	.filter(Boolean);
const lastTag = tags[0] ?? "";
const current = lastTag.replace(/^v/, "") || "0.0.0";
console.log(`last tag: ${lastTag || "(none)"} (current ${current})`);

// --- commits since the last tag ---------------------------------------------
const commits: Commit[] = [];
if (lastTag) {
	const shas = sh(`git log ${lastTag}..HEAD --format=%H`)
		.split("\n")
		.filter(Boolean);
	for (const sha of shas) {
		commits.push({
			sha,
			subject: sh(`git show -s --format=%s ${sha}`),
			body: sh(`git show -s --format=%b ${sha}`),
		});
	}
}

if (commits.some((c) => /\[skip release\]/i.test(`${c.subject} ${c.body}`))) {
	console.log("found [skip release] — exiting without a release");
	process.exit(0);
}

const bump = BUMP_OVERRIDE === "auto" ? deriveBump(commits) : BUMP_OVERRIDE;
if (bump === "none") {
	console.log("no release-worthy commits since last tag — nothing to do");
	process.exit(0);
}
console.log(`bump: ${bump} (${commits.length} commits since last tag)`);

// --- next version -----------------------------------------------------------
const [maj, min, pat] = current
	.split(".")
	.map((n) => Number.parseInt(n, 10) || 0);
const next =
	bump === "major"
		? `${maj + 1}.0.0`
		: bump === "minor"
			? `${maj}.${min + 1}.0`
			: `${maj}.${min}.${pat + 1}`;
console.log(`releasing Azoth v${next}`);

// --- changelog section ------------------------------------------------------
const date = new Date().toISOString().slice(0, 10);
const header = lastTag
	? `[v${next}](https://github.com/${REPO}/compare/${lastTag}...v${next})`
	: `[v${next}](https://github.com/${REPO}/releases/tag/v${next})`;

const breaking: string[] = [];
const features: string[] = [];
const fixes: string[] = [];
for (const c of commits) {
	const link = `([${c.sha.slice(0, 7)}](https://github.com/${REPO}/commit/${c.sha}))`;
	if (isBreaking(c)) breaking.push(`- ${c.subject} ${link}`);
	else if (/^feat(\([^)]*\))?:/.test(c.subject))
		features.push(`- ${c.subject} ${link}`);
	else if (/^(fix|perf)(\([^)]*\))?:/.test(c.subject))
		fixes.push(`- ${c.subject} ${link}`);
}

let section = `## ${header} (${date})\n`;
for (const [heading, items] of [
	["⚠️ Breaking Changes", breaking],
	["Features", features],
	["Bug Fixes", fixes],
] as const) {
	if (items.length > 0) section += `\n### ${heading}\n${items.join("\n")}\n`;
}
section = `${section.trim()}\n`;

// --- prepend to CHANGELOG.md ------------------------------------------------
const changelog = readFileSync("CHANGELOG.md", "utf8");
const firstVersionHeader = changelog.match(/^## \[/m);
if (firstVersionHeader?.index !== undefined) {
	writeFileSync(
		"CHANGELOG.md",
		`${changelog.slice(0, firstVersionHeader.index)}${section}\n${changelog.slice(firstVersionHeader.index)}`,
	);
} else {
	writeFileSync(
		"CHANGELOG.md",
		`${changelog.replace(/\n?$/, "\n")}${section}\n`,
	);
}

// --- commit, tag, push, release ---------------------------------------------
sh(`git config user.name "github-actions[bot]"`);
sh(
	`git config user.email "41898282+github-actions[bot]@users.noreply.github.com"`,
);
sh("git add CHANGELOG.md");
sh(`git commit -m "chore(repo): release azoth v${next}"`);
sh(`git tag v${next}`);
sh("git push origin HEAD");
sh(`git push origin v${next}`);

const notesFile = "/tmp/azoth-release-notes.md";
writeFileSync(notesFile, `${section}\n`);
sh(
	`gh release create v${next} --title "Azoth v${next}" --notes-file ${notesFile}`,
);
console.log(`published Azoth v${next}`);
