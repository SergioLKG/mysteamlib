# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The project has not published tagged releases yet, so entries are grouped by milestone date.

## [Unreleased]

### Added
- `npm run check` script (`astro check`) and `@types/node`.
- Unit tests with `vitest` (`npm test`) for pure logic: difficulty normalization, release-date parsing, profile-input parsing and the `/platino` filter and sort view.
- GitHub Actions workflow running `npm ci`, `npm run check`, `npm test` and `npm run build` on every push and pull request.
- `users.last_cron_attempt_at` column so the daily cron rotates through users fairly, whether their last attempt succeeded or failed.

### Changed
- `requireDb()` and `DatabaseNotConfiguredError` replace the scattered `if (!db)` checks. Cron endpoints now answer 500 with an explicit message instead of 200 `db-not-configured`.
- `runDailySync` orders users by `last_cron_attempt_at` (nulls first, then `id`) and stamps the column after every attempt.
- `syncLibraryIncremental` orders pending games by `library_synced_at` (nulls first) so the cron rotates instead of re-fetching the same games.
- Typed summaries for sync jobs (`DailySyncSummary`, `MetadataSyncSummary`, `RefreshGameResult`) and for the dashboard aggregations.
- Extracted pure modules `lib/platinum/view.ts`, `lib/sync/releaseDate.ts` and `lib/steam/profileInput.ts` so they can be tested. `ACH_MAX` and `TIME_MAX` now live in one place.
- Profile lookup accepts only `steamcommunity.com` and its subdomains (previously any host ending in that string).

### Removed
- `scripts/mark-stalled-achievements.ts`, superseded by the incremental sync.

## 2026-10-12

### Fixed
- Production outage: `@astrojs/vercel@11.0.13` loaded `rolldown` statically and every route returned 500. Upgraded to `^11.0.14`.
- Steam OpenID: `return_to` is verified by origin and path, which fixes login with `?next=`.
- Open redirect: `next` is validated against an allow-list on login and callback.
- `/api/cron/sync-library` rejects requests without the `Bearer` secret and fails closed in production.

### Changed
- Daily sync orders users by `last_synced_at` (nulls first).
- `package-lock.json` and `.env.example` are now versioned.

## 2026-09-10

### Added
- HowLongToBeat integration (`howlongtobeat-ts`) with throttling, a per-run cap and a kill switch.
- Privacy policy and terms pages, and a site footer.

### Changed
- Rarity weight in the difficulty score lowered from 0.7 to 0.5.

## 2026-09-09

### Added
- Steam sign-in, library sync, metadata backfill and per-game achievements.
- "Mi próximo platino" (`/platino`): ranked candidates, client-side filters, platinum badges.
- First-load sync page (`/sync`) with incremental, batched library sync.
- Public profile lookup on the home page.
- Dashboard hub and site header with avatar chip.

## 2026-09-02

### Added
- Astro on Vercel, Neon Postgres with Drizzle, health endpoint and Vercel Analytics.
