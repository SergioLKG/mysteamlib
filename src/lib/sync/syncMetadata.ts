import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { games, achievements, hltbMatches } from '../db/schema';
import { getSchemaForGame, getGlobalAchievementPercentagesForApp } from '../steam/webApi';
import { getStoreAppDetails } from '../steam/storeApi';
import { RateLimiter } from './rateLimiter';

// v1.0: HLTB integration is DEFERRED to 1.1 (see ../.opencode/docs/04). The
// hltb_matches table and this code path stay ready, but we do not hit the
// fragile HLTB scraper at runtime yet. Flip to true when 1.1 ships.
const HLTB_ENABLED = false;

export interface SyncMetadataResult {
  processed: number;
  gamesUpdated: number;
  hltbMatched: number;
  failures: number;
}

const steamLimiter = new RateLimiter(500); // ~2 requests/s
const storeLimiter = new RateLimiter(300);

const HLTB_REFRESH_DAYS = 90;

/**
 * Sync catalog metadata for a set of appids: Store details (genres, release,
 * header), achievement schema + global percentages, and HLTB completion times.
 *
 * Idempotent (upserts). HLTB is only re-consulted for games that are new or
 * whose hltb match is stale (> 90 days); a missing/null completionist time is
 * stored as NULL and never blocks the rest of the run.
 *
 * `force` bypasses staleness checks and re-fetches everything.
 */
export async function syncMetadata(
  appids: number[],
  opts: { force?: boolean } = {},
): Promise<SyncMetadataResult> {
  if (!db) throw new Error('Database not configured');
  const result: SyncMetadataResult = { processed: 0, gamesUpdated: 0, hltbMatched: 0, failures: 0 };

  for (const appid of appids) {
    result.processed += 1;

    // --- Catalog row: Store details ---
    try {
      await storeLimiter.next();
      const store = await getStoreAppDetails(appid);
      const now = new Date();
      await db
        .update(games)
        .set({
          genres: store?.data?.genres?.map((g) => g.description) ?? undefined,
          releaseDate: store?.data?.release_date?.date ?? undefined,
          headerImageUrl: store?.data?.header_image ?? undefined,
          metadataSyncedAt: now,
        })
        .where(eq(games.appid, appid));
      result.gamesUpdated += 1;
    } catch (e) {
      console.error(`Store metadata failed for appid=${appid}`, e);
      result.failures += 1;
    }

    // --- Achievement schema ---
    try {
      await steamLimiter.next();
      const schema = await getSchemaForGame(appid);
      const defs = schema.game?.availableGameStats?.achievements ?? [];

      // Track which apiNames exist this schema run so we can mark total count.
      for (const def of defs) {
        if (!def.name) continue;
        await db
          .insert(achievements)
          .values({
            appid,
            apiName: def.name,
            displayName: def.displayName ?? def.name,
            globalPercent: null,
          })
          .onConflictDoNothing();
      }

      await db
        .update(games)
        .set({ totalAchievements: defs.length, hasAchievements: defs.length > 0 })
        .where(eq(games.appid, appid));

      // Global percentages (per-achievement difficulty signal) — best effort.
      if (defs.length > 0) {
        await steamLimiter.next();
        const pct = await getGlobalAchievementPercentagesForApp(appid).catch((e) => {
          console.error(`Global percentages failed for appid=${appid}`, e);
          return null;
        });
        const pctMap = new Map(
          (pct?.achievementpercentages?.achievements ?? []).map((a) => [a.name, String(a.percent)]),
        );
        for (const def of defs) {
          if (!def.name || !pctMap.has(def.name)) continue;
          await db
            .update(achievements)
            .set({ globalPercent: pctMap.get(def.name)!, percentSyncedAt: new Date() })
            .where(and(eq(achievements.appid, appid), eq(achievements.apiName, def.name)));
        }
      }

    } catch (e) {
      // Schema/percent failures shouldn't kill the rest of the job.
      console.error(`Achievement schema failed for appid=${appid}`, e);
      result.failures += 1;
    }

    // --- HLTB match (cached, refreshed sparingly) ---
    if (HLTB_ENABLED) {
      const { searchGame } = await import('../hltb/client');
      const [existing] = await db
        .select({ syncedAt: hltbMatches.syncedAt })
        .from(hltbMatches)
        .where(eq(hltbMatches.appid, appid))
        .limit(1);

      const stale = !existing?.syncedAt || daysSince(existing.syncedAt) >= HLTB_REFRESH_DAYS;
      if (!opts.force && !stale) {
        continue;
      }

      const [gameRow] = await db
        .select({ name: games.name })
        .from(games)
        .where(eq(games.appid, appid))
        .limit(1);
      if (!gameRow?.name || gameRow.name === String(appid)) continue;

      const match = await searchGame(gameRow.name); // never throws
      await db
        .insert(hltbMatches)
        .values({
          appid,
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

      if (match.hltbId) result.hltbMatched += 1;
    }
  }

  console.log(`[syncMetadata] processed=${result.processed} gamesUpdated=${result.gamesUpdated} hltbMatched=${result.hltbMatched} failures=${result.failures}`);
  return result;
}

function daysSince(date: Date): number {
  return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
}
