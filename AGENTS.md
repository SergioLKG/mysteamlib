# AGENTS.md (./app)

Astro web app for **mysteamlib** — personal Steam library utility ("what to play", "what to platinum next"). This is the git repo root; product docs and roadmap live one level up (`../AGENTS.md`, `../.opencode/docs/`, `../ROADMAP.md`) — read those for the project briefing, build order, and open decisions.

## Commands (run from here, `./app`)
- `npm run dev` — dev server (foreground). Background mode: `npm run astro -- dev --background`.
- `npm run build` — production build (verify before committing).
- `npm run astro -- <cmd>` — pass through to Astro CLI (e.g. `npm run astro -- add svelte`).

## Closing a phase / milestone — always end with "Tareas para el dev:"
After finishing a phase or reaching a clean breakpoint (`punto y aparte`) at the end of a development session, the assistant MUST close its reply with a `Tareas para el dev:` block listing the concrete steps the developer (the owner) must do next. These are actions the agent needs to continue, or decisions/tests the developer must review. If there is genuinely nothing left for the developer to do, write something like `Escribir "continuar"` to signal the next session can proceed. Keep the list short, concrete, and ordered.

## Stack (locked)
Astro SSR on Vercel (adapter) · Postgres **Neon** · **Drizzle** ORM · Steam OpenID auth · **Svelte** islands · Vercel cron 1×/day · Node 24.

## Rules
- Never hand-write Vercel `functions`/`rewrites`/`routes` in `vercel.json` (breaks the Astro Vercel adapter → 405). Only `crons` allowed.
- Server endpoints live in `src/pages/api/*.ts` only (no root `/api`). Dynamic endpoints need `export const prerender = false;`.
- Never call Steam/Store/HLTB APIs at page-render time — DB only, refreshed by sync jobs (idempotent, resumable, batched).
- Code and comments in English; product docs (`../.opencode/docs/`) stay in Spanish.

## Steam API compliance (Valve TOS — `../.opencode/docs/STEAM-API-TERMS.md`)
- **100k calls/day** limit. Track usage in sync jobs; personal project is well under budget but always document the ceiling.
- Only retrieve Steam Data **as requested by the end user**. No prefetch without consent.
- Must publish a **privacy policy** listing what Steam Data is stored and where (country).
- API key stays in env vars only; never committed, never exposed client-side.
- Use **Steam OpenID** for auth; never ask for or store Steam passwords.
- Do **not** imply Valve/Steam endorsement. Use official "Sign in through Steam" buttons only.
- Data provided "as is" — disclaimers in UI for estimates (e.g. HLTB times).

## Current state (03 sep 2026)
- **Fase 1 cerrada.** Deploy en producción: `https://mysteamlib.vercel.app`, `/api/health` → `{"status":"ok","db":"connected"}`.
- Neon DB connected via Vercel Storage (`DATABASE_URL` + `POSTGRES_*` env on Vercel, mirrored in `.env.local`). `STEAM_API_KEY` + `SESSION_SECRET` set on Vercel + `.env.local`.
- Drizzle wired: `src/lib/db/schema.ts` (7 tables: `health_check`, `users`, `games`, `achievements`, `user_games`, `user_achievements`, `hltb_matches`), `src/lib/db/client.ts`, `drizzle.config.ts`, migrations in `drizzle/` (0001 applied to Neon). Scripts: `db:generate/migrate/push/studio`.
- `BaseLayout.astro` (in `src/layouts/`) integrates `@vercel/analytics` + `@vercel/speed-insights`. Required for all pages.
- **Fase 2 casi cerrada (03 sep 2026)**:
  - Steam wrappers: `src/lib/steam/webApi.ts` (`getOwnedGames`, `getPlayerAchievements`, `getSchemaForGame`, `getGlobalAchievementPercentagesForApp`, `getPlayerSummaries`) y `storeApi.ts` (`getStoreAppDetails`, backoff 429).
  - **HLTB — DIFERIDO a v1.1** (decisión propietario 03 sep: investigar/posible fork de `hltb-client` y adaptarlo). `src/lib/hltb/client.ts` usa `hltb-client` solo como **base de investigación — NO es dependencia fijada ni activada**. Sync escrito para que un fallo/ausencia de HLTB **nunca bloquee** (marca `not_found`, sigue). Feature `03` funciona sin tiempos HLTB en v1.0.
  - **Auth OpenID**: `src/lib/auth/openid.ts` (login URL + `check_authentication`), `src/lib/auth/session.ts` (HMAC cookie via `SESSION_SECRET`, 30d); endpoints `api/auth/login|callback|logout`; `src/middleware.ts` protects `/dashboard` + `api/games/*` (sets `context.locals.user`). Callback maps Steam `communityvisibilitystate` (3=público) → `users.profile_visibility`.
  - **Sync**: `src/lib/sync/` — `syncLibrary` (idempotent, resumable via `library_synced_at`), `syncMetadata` (Store+schema+global% + HLTB **disabled**, cached 90d, not_found never blocks), `runDailySync`/`runMetadataSync`/`refreshGame` (batched); cron endpoints `api/cron/sync-library|sync-metadata`; `api/games/[appid]/refresh.ts` (protected); crons in `vercel.json` (03:00 daily, Mon 04:00). Rate limiter in `lib/sync/rateLimiter.ts`. **Per-user minimalistic**: only writes `achievements_unlocked` count to `user_games`; `user_achievements` table is dormant/unused in v1.0 (owner decision — avoid per-user×achievement bloat).
  - **Logging**: sync jobs + orchestrators emit `console.log` JSON summaries (`[sync-library]`, `[sync-metadata]`, `[syncLibrary]`, `[syncMetadata]`) visible in Vercel logs so cron results/import counts are traceable.
  - **Frontend (basic)**: `index.astro` (landing + official "Sign in through Steam" button → `/api/auth/login`, legal disclaimer), `dashboard.astro` (protected placeholder for the `03` feature), logout POST `/api/auth/logout`.
  - Env additions: `CRON_SECRET` (optional bearer for cron); `.env.example` recreated. `.env.local` needs `CRON_SECRET` too if set.
- **Pendiente Fase 2**: verificación end-to-end en Vercel con usuario Steam real (login ✅; falta re-desplegar con los fixes para que `sync-library` recoja logros y `profile_visibility` pase a `public`, luego cerrar Fase 2).