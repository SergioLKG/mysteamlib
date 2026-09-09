import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { achievements, games, users, userAchievements, userGames } from '../db/schema';
import { getOwnedGames, getPlayerAchievements } from '../steam/webApi';
import { RateLimiter } from './rateLimiter';

export interface SyncResult {
  /**
   * SteamIDs (decimal strings) of games that are new to the catalog and
   * therefore still need metadata (Store schema, achievements, HLTB).
   */
  needsMetadata: number[];
  totalOwned: number;
  achievementSynced: number;
  skipped: number;
}

const steamLimiter = new RateLimiter(400); // ~2.5 requests/s for the achievements loop

/**
 * Sync a user's library: owned games + per-game achievement progress.
 *
 * Idempotent (all writes are upserts on natural keys) and resumable per-game:
 * a serverless run may be killed mid-way; on the next run any game whose
 * `library_synced_at` is already set is skipped. `force` bypasses that and
 * re-syncs everything (used by a manual full refresh).
 *
 * Returns the list of appids that are new to the catalog, so the caller can
 * hand them to syncMetadata.
 */
export async function syncLibrary(
  userId: string,
  opts: { force?: boolean } = {},
): Promise<SyncResult> {
  if (!db) throw new Error('Database not configured');

  const user = await db
    .select({ id: users.id, steamId: users.steamId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user[0]) throw new Error(`User not found: ${userId}`);

  const owned = await getOwnedGames(user[0].steamId, { includePlayedFreeGames: true });
  const ownedGames = owned.response.games ?? [];

  const result: SyncResult = { needsMetadata: [], totalOwned: ownedGames.length, achievementSynced: 0, skipped: 0 };

  for (const g of ownedGames) {
    // Upsert global catalog row (appid + name only; detail comes from syncMetadata).
    const existing = await db
      .select({ appid: games.appid })
      .from(games)
      .where(eq(games.appid, g.appid))
      .limit(1);

    if (!existing[0]) {
      await db
        .insert(games)
        .values({
          appid: g.appid,
          name: g.name ?? String(g.appid),
          hasAchievements: !!g.has_community_visible_stats,
        });
      result.needsMetadata.push(g.appid);
    }

    // Upsert the per-user library row (playtime, last played).
    await db
      .insert(userGames)
      .values({
        userId: user[0].id,
        appid: g.appid,
        playtimeMinutes: g.playtime_forever,
        playtime2weeksMinutes: g.playtime_2weeks,
        lastPlayedAt: g.rtime_last_played ? new Date(g.rtime_last_played * 1000) : null,
      })
      .onConflictDoUpdate({
        target: [userGames.userId, userGames.appid],
        set: {
          playtimeMinutes: sql`excluded.playtime_minutes`,
          playtime2weeksMinutes: sql`excluded.playtime_2weeks_minutes`,
          lastPlayedAt: sql`excluded.last_played_at`,
        },
      });

    // Resumability: skip only games whose achievement progress is already
    // fully synced (i.e. no row still has library_synced_at = NULL). A fresh
    // user_games row just upserted above has NULL, so it gets processed now;
    // games synced on a prior run (library_synced_at set) are skipped so a
    // serverless run can resume where it left off.
    if (!opts.force) {
      const pending = await db
        .select({ id: userGames.id })
        .from(userGames)
        .where(
          and(
            eq(userGames.userId, user[0].id),
            eq(userGames.appid, g.appid),
            isNull(userGames.librarySyncedAt),
          ),
        )
        .limit(1);
      if (!pending[0]) {
        result.skipped += 1;
        continue;
      }
    }

    // No visible stats → nothing to sync per-game; mark done and move on.
    if (!g.has_community_visible_stats) {
      await db
        .update(userGames)
        .set({ librarySyncedAt: new Date() })
        .where(and(eq(userGames.userId, user[0].id), eq(userGames.appid, g.appid)));
      result.achievementSynced += 1;
      continue;
    }

    await steamLimiter.next();
    const res = await getPlayerAchievements(user[0].steamId, g.appid).catch((e) => {
      // Steam can return 403 for games where the user has no stats (e.g. never
      // played). Don't let one failing game poison the run: log it, mark the
      // game as attempted so it isn't retried EVERY sync (avoids API/rate
      // burn + daily log spam). A manual refresh (refreshGame) or `force`
      // re-attempts it deliberately.
      console.warn(`[syncLibrary] GetPlayerAchievements failed for appid=${g.appid} (${user[0].steamId}); marking attempted. ${(e as Error).message}`);
      return null;
    });
    if (!res?.playerstats?.success) {
      await db
        .update(userGames)
        .set({ librarySyncedAt: new Date() })
        .where(and(eq(userGames.userId, user[0].id), eq(userGames.appid, g.appid)));
      result.skipped += 1;
      continue;
    }

    const ach = res.playerstats.achievements ?? [];
    const unlockedCount = ach.filter((a) => a.achieved === 1).length;

    // Fase 3 (owner decision 09 sep 2026): populate per-user achievement state.
    // GetPlayerAchievements returns the full schema list with the achieved flag,
    // so we upsert each row into the shared catalog (idempotent via the
    // (appid, api_name) unique index — self-heals games whose metadata sync
    // hasn't run yet) and store the user's unlock state in user_achievements.
    // This is what lets Fase 3 compute avg_global_rarity_remaining ("rarity of
    // the achievements you're still missing") accurately and unlocks future
    // per-achievement views. The badge count still lands in user_games.
    const withApiName = ach.filter((a) => a.apiname);

    if (withApiName.length) {
      await db
        .insert(achievements)
        .values(
          withApiName.map((a) => ({
            appid: g.appid,
            apiName: a.apiname as string,
            displayName: a.name,
          })),
        )
        .onConflictDoNothing();

      const catalog = await db
        .select({ id: achievements.id, apiName: achievements.apiName })
        .from(achievements)
        .where(eq(achievements.appid, g.appid));
      const catalogByApi = new Map(catalog.map((c) => [c.apiName, c.id]));

      const unlockRows = withApiName
        .filter((a) => catalogByApi.has(a.apiname as string))
        .map((a) => ({
          userId: user[0].id,
          achievementId: catalogByApi.get(a.apiname as string) as string,
          unlocked: a.achieved === 1,
          unlockedAt: a.unlocktime ? new Date(a.unlocktime * 1000) : null,
        }));

      if (unlockRows.length) {
        await db
          .insert(userAchievements)
          .values(unlockRows)
          .onConflictDoUpdate({
            target: [userAchievements.userId, userAchievements.achievementId],
            set: {
              unlocked: sql`excluded.unlocked`,
              unlockedAt: sql`excluded.unlocked_at`,
            },
          });
      }
    }

    await db
      .update(userGames)
      .set({ achievementsUnlocked: unlockedCount, librarySyncedAt: new Date() })
      .where(and(eq(userGames.userId, user[0].id), eq(userGames.appid, g.appid)));

    result.achievementSynced += 1;
  }

  await db
    .update(users)
    .set({ lastSyncedAt: new Date() })
    .where(eq(users.id, userId));

  console.log(`[syncLibrary] user=${user[0].steamId} owned=${result.totalOwned} achievementSynced=${result.achievementSynced} skipped=${result.skipped} newMeta=${result.needsMetadata.length}`);
  return result;
}
