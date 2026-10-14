# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The project has not published tagged releases yet, so entries are grouped by milestone date.

## [Unreleased]

### Added
- Landing v2 on `/`: themed (follows the OS theme, header toggle), hero with `HeroSpines.astro` (decorative CSS-only game spines with one amber "platinum" spine), 3-step "how it works" and check-icon lists. The profile lookup island keeps its v1 behaviour with token-based styles.
- `Icon.astro` and `Icon.svelte` with an inline Lucide icon map (`src/lib/ui/icons.ts`, lucide-static 1.57.0, ISC licence, no npm dependency).
- Theme infrastructure: `ThemeToggle.astro`, `themed` prop on `BaseLayout`, self-hosted Plus Jakarta Sans. Legacy pages stay pinned to dark; only `/` is themed.
- Design system: `DESIGN.md` and `src/styles/tokens.css` (dark and light themes, OKLCH semantic tokens). Not wired into layouts yet.
- Daily Steam API call counter (`steam_api_calls`) with a warning at 70 % and a hard stop at 95 % of the 100,000/day limit.
- Persistent per-IP rate limit for the profile lookup (`rate_limits`, keyed by an HMAC of the IP, never the raw address).
- `Cron sync` GitHub Actions workflow that calls the library sync endpoint every 30 minutes.
- `scripts/db-capacity.ts`: read-only database size report.
- `npm run check` script (`astro check`) and `@types/node`.
- Unit tests with `vitest` (`npm test`) for pure logic: difficulty normalization, release-date parsing, profile-input parsing and the `/platino` filter and sort view.
- GitHub Actions workflow running `npm ci`, `npm run check`, `npm test` and `npm run build` on every push and pull request.
- `users.last_cron_attempt_at` column so the daily cron rotates through users fairly, whether their last attempt succeeded or failed.

### Changed
- `SiteHeader`, `SiteFooter` and the skip link use `var(--legacy, var(--color-*))` instead of hex fallbacks, so legacy pages look the same and `themed` pages follow the design tokens. The avatar fallback chip keeps its legacy gradient, built with `color-mix` from `--accent` and `--accent-2`. The `<meta name="theme-color">` values moved to `src/lib/ui/theme-colors.ts`.
- The privacy policy now discloses the `mysteamlib-theme` localStorage entry (`light|dark`, theme preference only, never leaves the browser) and `BaseLayout` imports `tokens.css`; no page opts into the new theme yet.
- The Vercel production build now applies pending Drizzle migrations before `astro build` (`VERCEL_ENV=production` only; local, preview and CI builds never migrate).
- The privacy policy states that mysteamlib is not affiliated with Valve, like the terms of use.
- `user_achievements` now stores only unlocked achievements (about 10x smaller); locked ones are derived from the catalog. Migration `0005` removes the old locked rows and a redundant index.
- The profile lookup answers 502/503 with JSON when Steam fails instead of a bare 500.
- Privacy policy describes the abuse-control data and the more frequent scheduled sync.
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
