# ARCHITECTURE.md

How mysteamlib is built and **how new code must fit in**. This file travels with the repo; extended product docs live outside it (owner's local `../docs/`).

## 1. Shape of the system

```
Browser
  │  HTML (SSR) + Svelte islands (client:load only where interactive)
  ▼
Astro SSR on Vercel (@astrojs/vercel, output: 'server')
  ├─ src/middleware.ts ............ session → locals.user; guards private routes
  ├─ src/pages/*.astro ............ pages: read from DB only, never external APIs
  ├─ src/pages/api/**/*.ts ........ JSON endpoints (thin: auth → lib → Response)
  └─ src/lib/
       ├─ auth/ ................... Steam OpenID + HMAC cookie session
       ├─ sync/ ................... jobs: batched, idempotent, resumable
       ├─ steam/, hltb/ ........... external clients (only called from sync/ or lookup)
       └─ db/
            ├─ queries/ ........... read models (SQL, derived fields, scoring)
            ├─ schema.ts .......... Drizzle schema (source of truth)
            └─ client.ts .......... Neon HTTP driver (db may be null)
  ▼
Neon Postgres (us-east-1)        ◄── Vercel crons (daily library, weekly metadata)
```

External data flow is **one-way**: Steam / Store / HLTB → `lib/sync` → Postgres → `lib/db/queries` → pages/endpoints → islands. The only exception is `POST /api/profiles/lookup` (public, on explicit visitor request, never writes to the DB).

## 2. Layer rules

| Layer | May import | Must not |
|---|---|---|
| Islands (`components/*.svelte`) | other islands, shared constants/types | import `lib/db`, `lib/steam`, `lib/hltb`, `lib/auth` or read secrets |
| Static components/layouts (`.astro`) | `lib/db/queries` (target), props | call external APIs |
| Pages (`pages/*.astro`) | `lib/db/queries`, `locals.user` | call external APIs; hold business logic or inline SQL (target, see §6) |
| Endpoints (`pages/api/**`) | `lib/*` | contain domain logic beyond auth, input parsing and response shaping |
| `lib/sync` | `lib/steam`, `lib/hltb`, `lib/db` | be called during page render |
| `lib/steam`, `lib/hltb` | `fetch`, env | touch the DB |
| `lib/db/queries` | `schema`, `client`, pure helpers | call external services |

## 3. Non-negotiable rules

1. **No external API calls at render time.** Pages read the DB; sync jobs fill it.
2. **Jobs are idempotent and resumable**: small batches, upserts, progress persisted (`library_synced_at`, `metadata_synced_at`, `library_sync_error`). Any invocation can die mid-run on the serverless timeout.
3. **Filtering/sorting/aggregation in SQL** for data queries. Exception (owner decision): `/platino` fetches the full candidate set once and filters in the island; its semantics must stay identical to `lib/db/queries/library.ts`.
4. **Never invent data**: unknown values are `null`, rendered as "Sin dato", sorted last.
5. **Product formulas are named constants** (`difficulty.ts`, sync batch sizes, TTLs), never magic numbers.
6. **Secrets server-side only.** Credentials and `DATABASE_URL` live only in `.env.local` and Vercel env vars; code references `process.env.*`. Never inline connection strings anywhere committable.
7. **`vercel.json` holds only `crons`.** No `functions`/`rewrites`/`routes` (they override the adapter → 405).
8. **Endpoints only under `src/pages/api/`**, each with `export const prerender = false;`.
9. **Private routes must be added to `src/middleware.ts`** — nothing is protected by default. Endpoints use `locals.user.userId`, never a client-supplied user id.
10. **Valve API terms**: fetch Steam data only on user request, 100k calls/day ceiling, no Valve endorsement implied, privacy policy kept in sync with `schema.ts`.

## 4. Data model in one paragraph

Shared **catalog** (`games`, `achievements`, `hltb_matches`) is synced once per game for everyone; **per-user progress** (`users`, `user_games`, `user_achievements`) is synced per user. Derived fields (`achievements_remaining`, `completion_percent`, `avg_global_rarity_remaining`, `estimated_time_to_platinum`, `difficulty_score`) are computed in SQL in `lib/db/queries/library.ts`. Schema changes go `schema.ts` → `npm run db:generate` → review SQL → `npm run db:migrate` (production DB: owner approval required) → update the privacy page if stored data changed.

## 5. Where does new code go?

| I need to… | Put it in |
|---|---|
| A new page | `src/pages/<route>.astro` on `BaseLayout` (`DashLayout` if logged-in); add to middleware if private |
| A JSON endpoint | `src/pages/api/<area>/<name>.ts`; logic in `lib/` |
| A read query / derived metric | `src/lib/db/queries/<area>.ts` |
| A tunable product constant | next to its domain (`queries/difficulty.ts`, `sync/config.ts`) and exported |
| Data from Steam/Store/HLTB | client in `lib/steam` or `lib/hltb`, persisted by a job in `lib/sync`, read via `queries/` |
| A new scheduled job | function in `lib/sync/index.ts` + `pages/api/cron/<name>.ts` (Bearer `CRON_SECRET`) + `crons` entry in `vercel.json` (Hobby: max 1×/day) |
| A bulk/one-off data fix | `scripts/<name>.ts` (idempotent, resumable, `--force`/`--limit` style flags) |
| Interactive UI | Svelte 5 island (runes; `$derived` over `$effect`), hydrated with `client:load` only where needed |
| Shared UI chrome | `src/components/*.astro` |

## 6. Target evolution (known gaps → direction)

- Move DB access out of `dashboard.astro`, `platino.astro` and `SiteHeader.astro` into `lib/db/queries/{dashboard,users}.ts`.
- Split `LibraryExplorer.svelte` (~1300 lines) into card/toolbar components plus a `.svelte.ts` view-model; share `ACH_MAX`/`TIME_MAX` with `FiltersPanel`.
- Centralize sync tunables (`MAX_GAMES_PER_CHUNK`, `REFRESH_TTL_MS`, cron batch config) in `lib/sync/config.ts`.
- Shared auth allowlist (`ALLOWED_NEXT`) validated in both login and callback; fix `return_to` comparison.
- Fail closed on cron auth when `CRON_SECRET` is missing in production; rotate users in `runDailySync`.
- Add `astro check` + `vitest` for pure functions (scoring, normalization, `buildView` parity, parsers); then a minimal CI (`check` + `build`).
- Commit the lockfile for reproducible builds.

## 7. Conventions

- TypeScript strict. Code, identifiers, comments and commit messages in English; UI copy in Spanish (tone: first person only in titles/CTAs).
- Accessibility first: semantic HTML, focus-visible, `aria-*` on custom controls, `prefers-reduced-motion` respected.
- Structured logs: one JSON line per job with a `[job-name]` prefix.
