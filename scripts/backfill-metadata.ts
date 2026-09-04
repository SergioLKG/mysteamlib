/**
 * One-time local backfill of catalog metadata for all games that still have
 * `metadata_synced_at IS NULL`.
 *
 * Why this exists: the Vercel metadata cron (`runMetadataSync`) is intentionally
 * *resumable and batched* (maxMetadataApps default 25) so a single serverless
 * invocation never times out. That's great for ongoing maintenance, but for the
 * one-time backfill of ~hundreds of games it would take many cron runs.
 * Running it here, in a local Node session, has no serverless time limit, so we
 * loop until the backlog is drained.
 *
 * Idempotent & resumable: `syncMetadata` upserts on natural keys and sets
 * `metadata_synced_at`, so re-running this script is always safe — it just
 * picks up whatever is still NULL (or, with `--force`, re-fetches everything).
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/backfill-metadata.ts
 *   node --env-file=.env.local --import tsx scripts/backfill-metadata.ts --force
 */
import { count, isNull, sql } from 'drizzle-orm';
import { db, } from '../src/lib/db/client';
import { games } from '../src/lib/db/schema';
import { runMetadataSync } from '../src/lib/sync';

// Higher than the cron default (25) because we're not bound by the serverless
// timeout here. ~50 keeps the loop readable and the run resumable if it's
// interrupted; feel free to raise it.
const BATCH = Number(process.env.BATCH ?? 50);
const FORCE = process.argv.includes('--force');
const MAX_STALLED_ITERATIONS = 3;

if (!db) {
  console.error('DATABASE_URL not set — aborting.');
  process.exit(1);
}

async function pendingCount(): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(games)
    .where(FORCE ? sql`1 = 1` : isNull(games.metadataSyncedAt));
  return Number(value);
}

async function main() {
  let totalProcessed = 0;
  let stalled = 0;
  let prevPending = await pendingCount();
  console.log(`[backfill] starting. pending=${prevPending} force=${FORCE} batch=${BATCH}`);
  if (prevPending === 0) {
    console.log('[backfill] nothing to do — metadata catalog is fully populated.');
    return;
  }

  for (let i = 1; ; i++) {
    const res = await runMetadataSync({ maxMetadataApps: BATCH });
    totalProcessed += res.processed;
    console.log(
      `[backfill] run ${i}: processed=${res.processed} gamesUpdated=${res.gamesUpdated} ` +
        `hltbMatched=${res.hltbMatched} failures=${res.failures} (cumulative=${totalProcessed})`,
    );

    if (res.processed === 0) break;

    const pending = await pendingCount();
    if (pending === 0) {
      console.log('[backfill] done — no pending games remain.');
      break;
    }

    // Guard against an infinite loop if some games permanently fail to resolve
    // metadata (e.g. removed titles). If the backlog isn't shrinking across
    // several iterations, stop and report instead of hammering the APIs.
    if (pending >= prevPending) {
      stalled++;
      if (stalled >= MAX_STALLED_ITERATIONS) {
        console.warn(
          `[backfill] stalled: backlog not shrinking (${pending} pending after ${i} runs). ` +
            'Stopping to avoid useless API calls. Re-run later or investigate failures.',
        );
        break;
      }
    } else {
      stalled = 0;
    }
    prevPending = pending;
  }

  const left = await pendingCount();
  console.log(
    `[backfill] finished. totalProcessed=${totalProcessed} remainingPending=${left}` +
      (left > 0 ? ' (see warnings above)' : ' 🎉 — catalog fully backfilled'),
  );
}

main().catch((e) => {
  console.error('[backfill] fatal error:', e);
  process.exit(1);
});
