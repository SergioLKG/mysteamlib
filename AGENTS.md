# AGENTS.md (app/ — git repo root)

> `CLAUDE.md` is a symlink to this file. Keep it **under 100 lines**: hard rules + pointers only. No progress logs here — history goes to the changelog.

**mysteamlib**: personal Steam library utility. Main feature: "Mi próximo platino" (`/platino`), which ranks the games that are best to 100 % next. Production: https://mysteamlib.vercel.app

## Read first

| What | Where |
|---|---|
| Architecture, layer rules, where new code goes | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Setup and commands | [`README.md`](README.md) |
| Full product docs (Spanish, **owner's local machine only**, outside the repo) | `../docs/README.md` → code map, data model, sync, auth, features, decisions, tech debt, changelog |
| Phase status | `../ROADMAP.md` (local only) |

If `../docs/` is missing (fresh clone), rely on `ARCHITECTURE.md` and the code itself.

## Commands (run from `app/`)

- `npm run dev`: dev server on :4321. `npm run build`: production build.
- `npm run check`: type-check (cheapest verification). `npm test`: vitest, pure logic only (no DB, no network).
- `npm run db:generate`: SQL migration from `src/lib/db/schema.ts`. `npm run db:migrate` targets the **production** DB: **only with explicit owner approval**. The Vercel production build runs `drizzle-kit migrate` itself (`VERCEL_ENV=production` only), so pushing to production applies pending migrations: keep them backwards compatible.
- Local scripts: `node --env-file=.env.local --import tsx scripts/<name>.ts [flags]`. They hit the **real** DB.

## Stack (locked; do not reopen)

Astro 7 SSR + `@astrojs/vercel` (Hobby) · Svelte 5 islands (runes) · Neon Postgres (HTTP driver) · Drizzle ORM · Steam OpenID + HMAC cookie · Vercel crons (max 1×/day) · Node ≥24. Free tiers only: never propose paid services.

## Hard rules

1. **Never call Steam / Store / HLTB at page-render time.** DB first, filled by sync jobs (`src/lib/sync`). The only exception is the public profile lookup (no DB writes).
2. Sync jobs are **idempotent, resumable and batched**: the serverless timeout can kill any run.
3. `vercel.json` = **`crons` only**. Never `functions`/`rewrites`/`routes` (they break the adapter → 405).
4. Endpoints only in `src/pages/api/**` with `export const prerender = false;`. No root `/api`.
5. New private route → add it to `src/middleware.ts`. Use `locals.user.userId`, never a client-supplied id.
6. Data queries filter, sort and aggregate in **SQL** (`src/lib/db/queries`). Exception: `/platino` filters client-side; keep `buildView` (`src/lib/platinum/view.ts`) and `library.ts` semantically identical.
7. Unknown data is `null` ("Sin dato"), sorted last. Never invent numbers.
8. Product formulas and tunables are **named constants** (e.g. `DIFFICULTY_WEIGHTS` in `queries/difficulty.ts`).
9. Schema or cookie changes → review the legal pages (`privacidad.astro`, `terminos.astro`); their text is derived from `schema.ts`.
10. Before adding any third-party wrapper (especially HLTB), **verify it works against the real service** and check its maintenance status.

## Secrets

**Golden rule: credentials/DATABASE_URL live ONLY in `.env.local` (and Vercel env vars); code/migrations/configs reference `process.env.DATABASE_URL`, never inline credentials.** Same for `STEAM_API_KEY`, `SESSION_SECRET` and `CRON_SECRET`: server-side only, never in islands, never logged. Template: `.env.example`.

## Steam API compliance (Valve terms)

- 100,000 calls/day per key. Keep sync batches bounded and document the call budget.
- Fetch Steam data only **as requested by the user**. No unsolicited prefetching.
- Keep the privacy policy accurate: what is stored and where (Neon `us-east-1`).
- OpenID only. Never ask for or store Steam passwords. Official "Sign in through Steam" button.
- Do not imply Valve endorsement. Show "as is" disclaimers for estimates (HLTB).

## Skills (local, in `.agents/skills/`, symlinked from `.claude/skills/`; git-excluded)

- `svelte-core-bestpractices`: **always** when writing or reviewing `.svelte`.
- `astro`: pages, endpoints, config.
- `neon-drizzle` ⚠️: schema and migrations. It may try to inline credentials (Snyk W007); the golden rule above wins.
- If available: `web-design-guidelines` for any UI (owner wants *feel-first*, smooth, accessible UI) and `writing-guidelines` for UI copy and legal text.

## Language and tone

- Code, identifiers, comments and commits in **English** (Conventional Commits for new work).
- UI copy in **Spanish**: first person ("Mi …") only in titles and CTAs; body text neutral, using informal "tú"; legal pages formal. Brand always lowercase: "mysteamlib".

## Working agreement

- Don't commit, push or run migrations unless the owner asks (the Vercel production build applies pending migrations on deploy).
- Features marked as backlog (e.g. "Resoluciones de Año Nuevo", public `/platino` by URL) are **only built on explicit request**.
- Open product decisions are proposed with a default and confirmed by the owner, never fixed silently.
- When a phase ends or the session reaches a clean breakpoint, end the reply with a **`Tareas para el dev:`** block: short, ordered, concrete. If there is nothing pending, write `Escribir "continuar"`.
- After changing code, update the matching doc in `../docs/` (mapping table in `../docs/README.md`).
