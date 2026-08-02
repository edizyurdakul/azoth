# Changelog

All notable changes to Azoth are documented in this file. Versioning follows
Conventional Commits — `feat` bumps minor, `fix` bumps patch, breaking changes
bump major. Because nothing here is published, the version is a signal to
self-hosters about breaking config/schema changes, not an npm release.

## [1.0.0](https://github.com/edizyurdakul/azoth/releases/tag/v1.0.0) (2026-08-02)

First public release: cookieless, self-hosted web analytics on Cloudflare
Workers + Analytics Engine.

### Features

- **ingestion:** implement `/collect` write path ([#2](https://github.com/edizyurdakul/azoth/pull/2))
- **tracker:** track SPA route changes via history API ([#8](https://github.com/edizyurdakul/azoth/pull/8))
- **tracker:** honor GPC and DNT opt-out signals ([#9](https://github.com/edizyurdakul/azoth/pull/9))
- **dashboard:** read path ([#3](https://github.com/edizyurdakul/azoth/pull/3))
- **dashboard:** add breakdowns, bounce rate, and realtime queries ([#6](https://github.com/edizyurdakul/azoth/pull/6))
- **dashboard:** site management ([#7](https://github.com/edizyurdakul/azoth/pull/7))
- **dashboard:** analytics engine usage endpoint + card ([#11](https://github.com/edizyurdakul/azoth/pull/11))
- **dashboard-ui:** React SPA dashboard ([#5](https://github.com/edizyurdakul/azoth/pull/5))
- **dashboard-ui:** add custom date range picker ([#10](https://github.com/edizyurdakul/azoth/pull/10))

### Miscellaneous Chores

- add lint, typecheck, test tooling and git hooks ([#1](https://github.com/edizyurdakul/azoth/pull/1))
- add MIT license ([#12](https://github.com/edizyurdakul/azoth/pull/12))
