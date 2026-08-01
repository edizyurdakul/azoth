# dashboard

Read path for Azoth. Serves authenticated JSON endpoints backed by Cloudflare
Analytics Engine's synchronous SQL API.

## Endpoints

All endpoints require `Authorization: Bearer <AUTH_SECRET>`.

- `GET /api/pageviews?siteId=<id>&from=<ms>&to=<ms>&bucket=<hour|day>`
  Pageview time series (bucket defaults to `day`).
- `GET /api/uniques?siteId=<id>&from=<ms>&to=<ms>`
  Unique visitor count for the range (distinct visitorHash).

`from`/`to` are Unix milliseconds. `siteId` must match
`^[A-Za-z0-9_-]{1,64}$`.

## Configuration

`CF_ACCOUNT_ID` is set as a plaintext `[vars]` in `wrangler.toml` (not sensitive).
Secrets (set via `wrangler secret put <NAME>` or `.dev.vars` locally):

- `CF_API_TOKEN` — token with AE query permission.
- `AUTH_SECRET` — shared secret; see `src/auth.ts` (swapped for real auth in Epic E).

## Deploy

The dashboard reads Analytics Engine, so the **ingestion Worker must be deployed
and have written at least one event first** (the `azoth` dataset auto-creates on
first write). Order matters.

```bash
# 1. auth (one-time)
bunx wrangler login

# 2. secrets
echo "$CF_API_TOKEN" | bunx wrangler secret put CF_API_TOKEN
echo "$AUTH_SECRET"  | bunx wrangler secret put AUTH_SECRET

# 3. deploy (from apps/dashboard)
bun run deploy
```

AE is eventually consistent; wait ~30s after writing before querying. Verify:

```bash
curl -H "Authorization: Bearer $AUTH_SECRET" \
  "https://<dashboard>.workers.dev/api/pageviews?siteId=<id>&from=<ms>&to=<ms>"
```

## Local dev

```bash
bun install
bun run typecheck
bun run test
```
