# mysteamlib

Personal Steam library utility. Signs in with Steam, syncs your library and achievements, and answers **"which game should I 100 % next?"** with real filters (remaining achievements, global rarity and HowLongToBeat completionist time).

Production: https://mysteamlib.vercel.app

## Stack

Astro 7 (SSR, Vercel adapter) · Svelte 5 islands · Neon Postgres · Drizzle ORM · Steam OpenID · Vercel crons · Node ≥ 24.

## Setup

```sh
npm install
cp .env.example .env.local   # fill in the values (never commit .env.local)
npm run dev                  # http://localhost:4321
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `STEAM_API_KEY` | Steam Web API key (https://steamcommunity.com/dev/apikey) |
| `STEAM_OPENID_REALM` | Public origin (`http://localhost:4321` locally) |
| `SESSION_SECRET` | Long random string used to sign the session cookie |
| `CRON_SECRET` | Bearer token for `/api/cron/*` |
| `HLTB_ENABLED`, `HLTB_MIN_INTERVAL_MS` | Optional HowLongToBeat switches |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `npm run build` / `npm run preview` | Astro dev server, production build, preview |
| `npm run astro -- check` | Type-check |
| `npm run db:generate` | Generate a SQL migration from `src/lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm run db:studio` | Drizzle Studio |
| `node --env-file=.env.local --import tsx scripts/<name>.ts` | Maintenance and backfill scripts (`scripts/`) |

## Docs

- [`ARCHITECTURE.md`](ARCHITECTURE.md): layers, rules and where new code goes.
- [`AGENTS.md`](AGENTS.md): rules for coding assistants (`CLAUDE.md` links to it).

mysteamlib is not affiliated with or endorsed by Valve. Steam data is provided "as is".
