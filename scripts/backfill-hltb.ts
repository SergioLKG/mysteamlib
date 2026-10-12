/**
 * Local backfill of HowLongToBeat completion times for the whole catalog.
 *
 * Why a local script: the Vercel metadata cron is batched and capped (4 HLTB
 * lookups per run, to stay inside the serverless timeout), which is right for
 * maintenance but far too slow to fill ~hundreds of games. Locally there is no
 * timeout, and the client throttles itself (~1 request/1.2s) so HLTB is not
 * hammered.
 *
 * Idempotent & resumable: `hltb_matches` is upserted on `appid` and
 * `synced_at` is always written, so re-running only picks up what is still
 * missing or older than 90 days. Pass `--force` to re-match everything.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/backfill-hltb.ts
 *   node --env-file=.env.local --import tsx scripts/backfill-hltb.ts --force
 *   node --env-file=.env.local --import tsx scripts/backfill-hltb.ts --limit 20
 */
import { isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '../src/lib/db/client';
import { games, hltbMatches } from '../src/lib/db/schema';
import { searchGame, HLTB_FUZZY_THRESHOLD } from '../src/lib/hltb/client';

const FORCE = process.argv.includes('--force');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Number.POSITIVE_INFINITY;
const STALE_BEFORE = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

if (!db) {
  console.error('DATABASE_URL not set — aborting.');
  process.exit(1);
}

async function main() {
  const conditions = [isNull(hltbMatches.syncedAt), lt(hltbMatches.syncedAt, STALE_BEFORE)];
  if (FORCE) conditions.length = 0;

  const base = db
    .select({ appid: games.appid, name: games.name })
    .from(games)
    .leftJoin(hltbMatches, sql`${hltbMatches.appid} = ${games.appid}`)
    .where(conditions.length > 0 ? or(...conditions) : undefined)
    .orderBy(games.appid);
  const pending = Number.isFinite(LIMIT) ? await base.limit(LIMIT) : await base;

  console.log(
    `[backfill-hltb] starting. pending=${pending.length} force=${FORCE} fuzzyThreshold=${HLTB_FUZZY_THRESHOLD}`,
  );
  if (pending.length === 0) {
    console.log('[backfill-hltb] nothing to do — catalog is fully matched.');
    return;
  }

  let matched = 0;
  let notFound = 0;
  let withCompletionist = 0;

  for (const [i, game] of pending.entries()) {
    const match = await searchGame(game.name); // never throws
    await db
      .insert(hltbMatches)
      .values({
        appid: game.appid,
        hltbId: match.hltbId,
        mainStoryHours: match.mainStoryHours ? String(match.mainStoryHours) : null,
        mainExtraHours: match.mainExtraHours ? String(match.mainExtraHours) : null,
        completionistHours: match.completionistHours ? String(match.completionistHours) : null,
        matchConfidence: match.matchConfidence,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: hltbMatches.appid,
        set: {
          hltbId: match.hltbId,
          mainStoryHours: match.mainStoryHours ? String(match.mainStoryHours) : null,
          mainExtraHours: match.mainExtraHours ? String(match.mainExtraHours) : null,
          completionistHours: match.completionistHours ? String(match.completionistHours) : null,
          matchConfidence: match.matchConfidence,
          syncedAt: sql`now()`,
        },
      });

    if (match.hltbId) {
      matched += 1;
      if (match.completionistHours) withCompletionist += 1;
    } else {
      notFound += 1;
    }
    console.log(
      `[${i + 1}/${pending.length}] ${game.name} (${game.appid}) -> ` +
        `${match.matchConfidence} hltb=${match.hltbId ?? '-'} ` +
        `completionist=${match.completionistHours ?? '-'}h`,
    );
  }

  console.log(
    `[backfill-hltb] done. matched=${matched} notFound=${notFound} ` +
      `withCompletionistTime=${withCompletionist}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[backfill-hltb] failed:', err);
    process.exit(1);
  });
