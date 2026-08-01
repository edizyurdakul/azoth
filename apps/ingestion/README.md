# ingestion

Write path for Azoth. Accepts pageview beacons at `POST /collect` and writes them
to Analytics Engine (dataset `azoth`, via the `ANALYTICS` binding).

## Endpoint

`POST /collect?siteId=<id>&path=<path>&referrer=<referrer>` — validates the
request, enriches it (UA parsing, country, rotating-salt visitor hash), and
writes a data point. `siteId` must match `^[A-Za-z0-9_-]{1,64}$`; `path` is
rejected over 16 KiB (UTF-8 bytes). CORS-enabled for the tracker snippet.

## Static assets

`tracker.min.js` is served as a static asset from `./public/` (Wrangler Assets).
Asset requests are served without invoking the Worker. The bundle is built by
`@azoth/tracker`:

```bash
bun run build:tracker   # writes ../tracker build output to public/tracker.min.js
```

The deploy script runs this build automatically before `wrangler deploy`.

## Deploy

Deploy the ingestion Worker first — the `azoth` dataset auto-creates on first
write, and the dashboard depends on it existing.

```bash
# 1. auth (one-time)
bunx wrangler login

# 2. deploy (from apps/ingestion)
bun run deploy
```

Then fire a test write to trigger dataset creation:

```bash
curl -X POST "https://<ingestion>.workers.dev/collect?siteId=test-1&path=%2F"
```

## Local dev

```bash
bun install
bun run typecheck
bun run test
```
