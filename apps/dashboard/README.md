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

Secrets (set via `wrangler secret put <NAME>` or `.dev.vars` locally):

- `CF_ACCOUNT_ID` — Cloudflare account for the AE read API.
- `CF_API_TOKEN` — token with AE query permission.
- `AUTH_SECRET` — shared secret; see `src/auth.ts` (swapped for real auth in Epic E).

## Local dev

```bash
bun install
bun run typecheck
bun run test
```
