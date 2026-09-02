# AGENTS.md (./app)

Astro web app for **mysteamlib** — personal Steam library utility ("what to play", "what to platinum next"). This is the git repo root; product docs and roadmap live one level up (`../AGENTS.md`, `../.opencode/docs/`, `../ROADMAP.md`) — read those for the project briefing, build order, and open decisions.

## Commands (run from here, `./app`)
- `npm run dev` — dev server (foreground). Background mode: `npm run astro -- dev --background`.
- `npm run build` — production build (verify before committing).
- `npm run astro -- <cmd>` — pass through to Astro CLI (e.g. `npm run astro -- add svelte`).

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

## Current state (02 sep 2026)
- Neon DB connected via Vercel Storage (`DATABASE_URL` in `.env.local`). `STEAM_API_KEY` + `SESSION_SECRET` set in `.env.local`.
- `@vercel/analytics` + `@vercel/speed-insights` installed (integrate in `BaseLayout.astro`).
- Health endpoint at `/api/health` (reports `db: configured` when `DATABASE_URL` exists).
- **Next**: Drizzle setup + real DB schema + `SELECT 1` health query + Vercel deploy.