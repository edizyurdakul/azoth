# Changelog

All notable changes to Azoth are documented in this file. Versioning follows
Conventional Commits — `feat` bumps minor, `fix` bumps patch, breaking changes
bump major. Because nothing here is published, the version is a signal to
self-hosters about breaking config/schema changes, not an npm release.

## [v1.2.0](https://github.com/edizyurdakul/azoth/compare/v1.1.0...v1.2.0) (2026-08-02)

### Features
- feat(r2-archiver): R2/Arrow daily archive (#22) ([7a4d6ae](https://github.com/edizyurdakul/azoth/commit/7a4d6ae1815dbd83f37d4f655fa82f092a505f23))

## [v1.1.0](https://github.com/edizyurdakul/azoth/compare/v1.0.2...v1.1.0) (2026-08-02)

### Features
- feat: rate limit the ingestion collector and login route (#20) ([a1b57c4](https://github.com/edizyurdakul/azoth/commit/a1b57c470d6e960bd80f329c6dc6c59c5b5c4b30))

## [v1.0.2](https://github.com/edizyurdakul/azoth/compare/v1.0.1...v1.0.2) (2026-08-02)

### Bug Fixes
- fix(repo): write release PR body to a file (#17) ([1e92882](https://github.com/edizyurdakul/azoth/commit/1e9288230c0151c26b4bddf3740f3f42170081c8))

## [v1.0.1](https://github.com/edizyurdakul/azoth/compare/v1.0.0...v1.0.1) (2026-08-02)

### Bug Fixes
- fix(repo): land releases via PR instead of pushing to main (#16) ([681c3db](https://github.com/edizyurdakul/azoth/commit/681c3db016aa04832a4ab99318511566412935e3))
- fix(dashboard): harden auth, responses, and query builders (#15) ([6a854e6](https://github.com/edizyurdakul/azoth/commit/6a854e60326a0ecf444cee8088d8adcf66f4f62f))

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
