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

## Skills (see `../.opencode/docs/SKILLS.md`)
Project-installed skills in `./.agents/skills/`: `astro`, `svelte-core-bestpractices`, `neon-drizzle`. Key rules:
- **Load `svelte-core-bestpractices` when writing/editing Svelte components** and `web-design-guidelines` when building/auditing UI (owner wants *feel-first*, smooth, attention-grabbing interfaces); `writing-guidelines` for UI copy/messages/legal text; `astro` for pages/config.
- ⚠️ **`neon-drizzle`** can embed DB credentials/connection strings verbatim (Snyk HIGH W007). **Golden rule: credentials/DATABASE_URL live ONLY in `.env.local` (and Vercel env vars); code/migrations/configs reference `process.env.DATABASE_URL`, never inline credentials.**
- `vercel-react-best-practices` is React/Next-only → does NOT apply (Astro+Svelte). Others (`vercel-optimize`, `find-skills`, `customize-opencode`) are on-demand.

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

## Current state (09 sep 2026)
- **Fase 1 cerrada.** Deploy en producción: `https://mysteamlib.vercel.app`, `/api/health` → `{"status":"ok","db":"connected"}`.
- Neon DB connected via Vercel Storage (`DATABASE_URL` + `POSTGRES_*` env on Vercel, mirrored in `.env.local`). `STEAM_API_KEY` + `SESSION_SECRET` set on Vercel + `.env.local`.
- Drizzle wired: `src/lib/db/schema.ts` (7 tables: `health_check`, `users`, `games`, `achievements`, `user_games`, `user_achievements`, `hltb_matches`), `src/lib/db/client.ts`, `drizzle.config.ts`, migrations in `drizzle/` (0001, 0002 applied to Neon). Scripts: `db:generate/migrate/push/studio`.
- `BaseLayout.astro` (in `src/layouts/`) integrates `@vercel/analytics` + `@vercel/speed-insights`. Required for all pages.
- **Fase 2 CERRADA (09 sep 2026)** — login Steam end-to-end ✅, sync jobs ✅, backfill metadata 359/359 ✅, catálogo `achievements` 24.9k sin duplicados. Detalles:
  - Steam wrappers: `src/lib/steam/webApi.ts` (`getOwnedGames`, `getPlayerAchievements`, `getSchemaForGame`, `getGlobalAchievementPercentagesForApp`, `getPlayerSummaries`) y `storeApi.ts` (`getStoreAppDetails`, backoff 429).
  - **HLTB — DIFERIDO a v1.1** (decisión propietario 03 sep: investigar/posible fork de `hltb-client` y adaptarlo). `src/lib/hltb/client.ts` usa `hltb-client` solo como **base de investigación — NO es dependencia fijada ni activada**. Sync escrito para que un fallo/ausencia de HLTB **nunca bloquee** (marca `not_found`, sigue). Feature `03` funciona sin tiempos HLTB en v1.0.
  - **Auth OpenID**: `src/lib/auth/openid.ts` (login URL + `check_authentication`), `src/lib/auth/session.ts` (HMAC cookie via `SESSION_SECRET`, 30d); endpoints `api/auth/login|callback|logout`; `src/middleware.ts` protects `/dashboard` + `api/games/*` (sets `context.locals.user`). Callback maps Steam `communityvisibilitystate` (3=público) → `users.profile_visibility`.
  - **Sync**: `src/lib/sync/` — `syncLibrary` (idempotente, resumible via `library_synced_at`; tras un fallo de `GetPlayerAchievements` el juego se marca *attempted* para no reintentar en cada sync), `syncMetadata` (Store+schema+global% + HLTB **disabled**, cached 90d, not_found never blocks; `parseReleaseDate()` sanitiza `release_date` ante texto libre tipo "To be announced"), `runDailySync`/`runMetadataSync`/`refreshGame` (batched, `maxMetadataApps=25` para el cron semanal); cron endpoints `api/cron/sync-library|sync-metadata`; `api/games/[appid]/refresh.ts` (protected); crons in `vercel.json` (03:00 daily, Mon 04:00). Rate limiter in `lib/sync/rateLimiter.ts`. **Desde Fase 3 (09/09): `syncLibrary` TAMBIÉN rellena `user_achievements`** (estado unlock por logro desde `GetPlayerAchievements`, catalog upsert autocurativo) — decisión propietario que revierte el "per-usuario minimalista" de Fase 2; migración de datos existentes vía `scripts/backfill-user-achievements.ts` (forced, idempotente; el cron diario NO repuebla lo ya sincronizado).
  - **Backfill script**: `scripts/backfill-metadata.ts` (local, `tsx`, no serverless timeout; loop idempotente/resumible + anti-infinite-loop guard). Reusable: `node --env-file=.env.local --import tsx scripts/backfill-metadata.ts [--force]`.
  - **Logging**: sync jobs + orchestrators emit `console.log` JSON summaries (`[sync-library]`, `[sync-metadata]`, `[syncLibrary]`, `[syncMetadata]`) visible in Vercel logs so cron results/import counts are traceable.
  - **Frontend (basic)**: `index.astro` (landing + official "Sign in through Steam" button → `/api/auth/login`, legal disclaimer), `dashboard.astro` (protected placeholder for the `03` feature), logout POST `/api/auth/logout`.
  - Env additions: `CRON_SECRET` (optional bearer for cron); `.env.example` recreated. `.env.local` needs `CRON_SECRET` too if set.
- **Estado tras CERRAR Fase 2**: ambos crons limpios — `sync-metadata` → `processed=0` (catálogo completo, mantenimiento no-op), `sync-library` → `skipped=359` (todo sincronizado; diario solo 1 llamada). **Siguiente: Fase 3** ("qué platinarse ahora").
- **FASE 3 EN CURSO (09/09)** — decisiones propiedad cerradas: pesos `difficulty_score` = logros 1.0 · rareza 0.7 · tiempo 0.5 (`src/lib/db/queries/difficulty.ts`); poblar `user_achievements`; solo dashboard logado. Implementado:
  - `src/lib/db/queries/library.ts` — `getPlatinumCandidates(userId, filters, sort)` (contra SQL via CTE; derivados `achievements_remaining`, `completion_percent`, `estimated_time_to_platinum`, `avg_global_rarity_remaining` por subquery correlacionada sobre `user_achievements`; base: `has_achievements` + `total_achievements>0` + ocultar 100% salvo `showCompleted`; nulls de tiempo SIEMPRE al final) + `getLibraryGenres(userId)`.
  - Endpoint GET `src/pages/api/games/platinum-candidates.ts` (protegido; `no-store`; meta con `total`, `partialEstimates`, `availableGenres`).
  - Isla Svelte 5 `src/components/LibraryExplorer.svelte` (runes; `$state.raw` para filas; onMount solo para primer fetch; debounce en búsqueda) montada en `src/pages/dashboard.astro` (renovado: hero, búsqueda, estado/progreso, género, sort+dirección, min-max logros/horas, checks "incluir sin dato"/"ver platinados", banner "sincronizando", filas con imagen/barra %/faltan/tiempo/etiqueta fácil·medio·largo). Svelte 5.57 instalado (`@astrojs/svelte`).
  - Scripts dev: `scripts/check-platinum.ts` (valida la query contra la BD real) y `scripts/backfill-user-achievements.ts`.
  - **Pendiente**: auditoría web-design-guidelines, deploy prod, revisión visual del propietario, y decidir ajuste de pesos con resultados reales.