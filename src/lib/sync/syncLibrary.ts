import { and, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
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

interface OwnedGameLike {
  appid: number;
  name?: string | null;
  has_community_visible_stats?: boolean;
}

/**
 * Sync one game's achievement progress for a user: marks it synced if the game
 * has no visible stats, otherwise pulls GetPlayerAchievements, upserts the
 * schema into the shared catalog (idempotent) and stores the user's unlock
 * state. Used both by the full `syncLibrary` (fill mode) and the incremental
 * batched sync (initial pasarela + stale refresh).
 */
async function syncOneGame(
  user: { id: string; steamId: string },
  g: OwnedGameLike,
): Promise<{ achievementSynced: number; skipped: number }> {
  const appid = g.appid;

  // No visible stats → nothing to sync per-game; mark done and move on.
  if (!g.has_community_visible_stats) {
    await db
      .update(userGames)
      .set({ librarySyncedAt: new Date(), librarySyncError: null })
      .where(and(eq(userGames.userId, user.id), eq(userGames.appid, appid)));
    return { achievementSynced: 1, skipped: 0 };
  }

  let attemptError: string | null = null;
  await steamLimiter.next();
  const res = await getPlayerAchievements(user.steamId, appid).catch((e) => {
    // Steam can return 403 for games where the user has no stats (e.g. never
    // played) or while the profile is private. Don't let one failing game
    // poison the run: log it and record the error so the next sync retries it.
    attemptError = (e as Error).message;
    console.warn(`[syncLibrary] GetPlayerAchievements failed for appid=${appid} (${user.steamId}); marking for retry. ${attemptError}`);
    return null;
  });
  if (!res?.playerstats?.success) {
    attemptError ??= 'GetPlayerAchievements: no playerstats';
    await db
      .update(userGames)
      .set({ librarySyncedAt: new Date(), librarySyncError: attemptError.slice(0, 300) })
      .where(and(eq(userGames.userId, user.id), eq(userGames.appid, appid)));
    return { achievementSynced: 0, skipped: 1 };
  }

  const ach = res.playerstats.achievements ?? [];
  const unlockedCount = ach.filter((a) => a.achieved === 1).length;

  // Fase 3 (owner decision 09 sep 2026): populate per-user achievement state.
  // GetPlayerAchievements returns the full schema list with the achieved flag,
  // so we upsert each row into the shared catalog (idempotent via the
  // (appid, api_name) unique index — self-heals games whose metadata sync
  // hasn't run yet) and store the user's unlock state in user_achievements.
  const withApiName = ach.filter((a) => a.apiname);

  if (withApiName.length) {
    await db
      .insert(achievements)
      .values(
        withApiName.map((a) => ({
          appid,
          apiName: a.apiname as string,
          displayName: a.name,
        })),
      )
      .onConflictDoNothing();

    const catalog = await db
      .select({ id: achievements.id, apiName: achievements.apiName })
      .from(achievements)
      .where(eq(achievements.appid, appid));
    const catalogByApi = new Map(catalog.map((c) => [c.apiName, c.id]));

    const unlockRows = withApiName
      .filter((a) => catalogByApi.has(a.apiname as string))
      .map((a) => ({
        userId: user.id,
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
    .set({ achievementsUnlocked: unlockedCount, librarySyncedAt: new Date(), librarySyncError: null })
    .where(and(eq(userGames.userId, user.id), eq(userGames.appid, appid)));

  return { achievementSynced: 1, skipped: 0 };
}

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
            librarySyncError: null,
          },
        });

    // Resumability + auto-retry: process any game whose achievement progress
    // is not yet fully synced (library_synced_at = NULL) OR whose last attempt
    // failed (library_sync_error set). A transient failure (e.g. a profile
    // that was private) is retried on the next cron instead of being final.
    if (!opts.force) {
      const pending = await db
        .select({ id: userGames.id })
        .from(userGames)
        .where(
          and(
            eq(userGames.userId, user[0].id),
            eq(userGames.appid, g.appid),
            or(
              isNull(userGames.librarySyncedAt),
              isNotNull(userGames.librarySyncError),
            ),
          ),
        )
        .limit(1);
      if (!pending[0]) {
        result.skipped += 1;
        continue;
      }
    }

    const perGame = await syncOneGame(user[0], g);
    result.achievementSynced += perGame.achievementSynced;
    result.skipped += perGame.skipped;
  }

  await db
    .update(users)
    .set({ lastSyncedAt: new Date() })
    .where(eq(users.id, userId));

  console.log(`[syncLibrary] user=${user[0].steamId} owned=${result.totalOwned} achievementSynced=${result.achievementSynced} skipped=${result.skipped} newMeta=${result.needsMetadata.length}`);
  return result;
}

export interface IncrementalSyncResult {
  /** The library is fully up to date (no pending games left this round). */
  done: boolean;
  /** How many games were pending at the start of this chunk. */
  totalPending: number;
  /** How many pending games were processed in this chunk. */
  processed: number;
  /** Games still pending after this chunk. */
  remainingPending: number;
  /** Appids new to the catalog discovered by the owned-games fetch. */
  needsMetadata: number[];
}

function pendingCondition(
  userId: string,
  since?: Date,
): ReturnType<typeof and> {
  if (since) {
    return and(
      eq(userGames.userId, userId),
      or(
        isNull(userGames.librarySyncedAt),
        isNotNull(userGames.librarySyncError),
        lt(userGames.librarySyncedAt, since),
      ),
    ) as ReturnType<typeof and>;
  }
  return and(
    eq(userGames.userId, userId),
    or(
      isNull(userGames.librarySyncedAt),
      isNotNull(userGames.librarySyncError),
    ),
  ) as ReturnType<typeof and>;
}

/**
 * Incremental, serverless-safe sync for one user.
 *
 * Runs a single bounded batch (default 12 games) and returns how much work
 * remains, so a client (the first-load pasarela or an on-demand refresh) can
 * keep calling it until `done`, without a single invocation ever exceeding the
 * platform function limit — the sync is naturally resumable because pending
 * games are those with `library_synced_at` NULL, a recorded error, or (when
 * `refreshOlderThanMs` is set) older than the freshness threshold.
 *
 * Modes:
 * - fill (default): only games never successfully synced or last failed.
 * - refresh (pass `refreshOlderThanMs`): also re-pulls achievement states for
 *   games last synced longer ago than that threshold (e.g. 6h), which is what
 *   keeps a user's data fresh after combat-changing events (SAMP, DLC, …).
 */
export async function syncLibraryIncremental(
  userId: string,
  opts: { maxGames?: number; refreshOlderThanMs?: number } = {},
): Promise<IncrementalSyncResult> {
  if (!db) throw new Error('Database not configured');

  const maxGames = opts.maxGames ?? 12;
  const since = opts.refreshOlderThanMs
    ? new Date(Date.now() - opts.refreshOlderThanMs)
    : undefined;

  const user = await db
    .select({ id: users.id, steamId: users.steamId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user[0]) throw new Error(`User not found: ${userId}`);

  // Category + owned-games refresh (1 API call) keeps playtime/ownership fresh
  // on every chunk and reports any appid new to the catalog.
  const owned = await getOwnedGames(user[0].steamId, { includePlayedFreeGames: true });
  const ownedGames = owned.response.games ?? [];
  const needsMetadata: number[] = [];

  for (const g of ownedGames) {
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
      needsMetadata.push(g.appid);
    }

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
          librarySyncError: null,
        },
      });
  }

  const pending = await db
    .select({
      appid: userGames.appid,
      hasStats: games.hasAchievements,
    })
    .from(userGames)
    .innerJoin(games, eq(games.appid, userGames.appid))
    .where(pendingCondition(user[0].id, since))
    .orderBy(userGames.appid)
    .limit(maxGames);

  let processed = 0;
  for (const row of pending) {
    const perGame = await syncOneGame(user[0], {
      appid: row.appid,
      has_community_visible_stats: row.hasStats,
    });
    processed += perGame.achievementSynced + perGame.skipped;
  }

  const [{ remaining }] = await db
    .select({ remaining: sql<number>`count(*)::int` })
    .from(userGames)
    .innerJoin(games, eq(games.appid, userGames.appid))
    .where(pendingCondition(user[0].id, since));

  const done = remaining === 0;
  if (done) {
    await db.update(users).set({ lastSyncedAt: new Date() }).where(eq(users.id, userId));
  }

  const result: IncrementalSyncResult = {
    done,
    totalPending: processed + remaining,
    processed,
    remainingPending: remaining,
    needsMetadata,
  };
  console.log(
    `[syncLibraryIncremental] user=${user[0].steamId} mode=${since ? 'refresh' : 'fill'} batch=${processed} totalPending=${result.totalPending} remaining=${remaining} done=${done} newMeta=${needsMetadata.length}`,
  );
  return result;
}
