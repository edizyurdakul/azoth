# azoth

Open-source, self-hosted, cookieless web analytics for Cloudflare Workers + Analytics Engine.

## Quick start

```bash
bun install
bunx azoth install
```

`azoth install` is a guided one-command deploy: it checks your Cloudflare login, patches the
wrangler configs with your account id, sets the dashboard secrets (`AUTH_SECRET`, `CF_API_TOKEN`),
deploys both workers, health-checks them, and prints your embed snippet.

- `bunx azoth doctor` — read-only pre-deploy diagnostics (also `--json`, CI-friendly).
- `bunx azoth status` — account, workers, secrets, and last deploy from `.azoth/state.json`.
- `bunx azoth install --yes` — non-interactive (set flags/env for all inputs).
- `bunx azoth install --dry-run` — preview what would change without writing or deploying.

See `docs/cli.md` for the full CLI design.

## Scripts

| Command | What it does |
|---|---|
| `bun run lint` / `bun run lint:fix` | Biome check / auto-fix |
| `bun run typecheck` | `tsc --noEmit` across all workspaces |
| `bun run test` | Runs every workspace's test suite |

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
