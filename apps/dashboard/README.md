# dashboard

Read path for Azoth. Serves a browser UI plus authenticated JSON endpoints
backed by Cloudflare Analytics Engine's synchronous SQL API.

## UI

`GET /` serves the dashboard page (pageview total, unique visitors, trend line).
Sign in with the `AUTH_SECRET` via the login form; the secret is exchanged for an
HttpOnly `azoth_auth` cookie (`SameSite=Lax`, 30-day expiry). Log out clears it.

## Endpoints

Require `Authorization: Bearer <AUTH_SECRET>` **or** the `azoth_auth` cookie.

- `GET /api/pageviews?siteId=<id>&from=<ms>&to=<ms>&bucket=<hour|day>`
  Pageview time series (bucket defaults to `day`).
- `GET /api/uniques?siteId=<id>&from=<ms>&to=<ms>`
  Unique visitor count for the range (distinct visitorHash).

`from`/`to` are Unix milliseconds. `siteId` must match
`^[A-Za-z0-9_-]{1,64}$`.

Auth endpoints (no auth required):

- `POST /api/login` — body `{ "secret": "<AUTH_SECRET>" }`; sets the `azoth_auth` cookie on success.
- `POST /api/logout` — clears the `azoth_auth` cookie.

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
