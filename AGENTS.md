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