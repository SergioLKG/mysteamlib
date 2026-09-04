import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { users, userGames } from '../db/schema';
import { syncLibrary, type SyncResult } from './syncLibrary';
import { syncMetadata, type SyncMetadataResult } from './syncMetadata';

export interface BatchConfig {
  maxUsers?: number;
  maxAchievementGames?: number;
  maxMetadataApps?: number;
}

const DEFAULT_CONFIG: Required<BatchConfig> = {
  maxUsers: 5,
  maxAchievementGames: 40,
  maxMetadataApps: 25,
};

/**
 * Daily cron entry point: sync library (owned games + achievements) for a
 * bounded number of users, then queue metadata work for any new games.
 * Idempotent and resumable per-game via `library_synced_at`.
 */
export async function runDailySync(cfg: BatchConfig = {}): Promise<unknown> {
  if (!db) return { ok: false, reason: 'db-not-configured' };
  const config: Required<BatchConfig> = { ...DEFAULT_CONFIG, ...cfg };

  const activeUsers = await db
    .select({ id: users.id, steamId: users.steamId })
    .from(users)
    .limit(config.maxUsers);

  const results: { user: string; library: SyncResult | null; error?: string }[] = [];

  for (const u of activeUsers) {
    try {
      const library = await syncLibrary(u.id, { force: false });
      const metadataAppids = library.needsMetadata.slice(0, config.maxMetadataApps);
      if (metadataAppids.length > 0) {
        await syncMetadata(metadataAppids, { force: false });
      }
      results.push({ user: u.steamId, library });
    } catch (e) {
      console.error(`Daily sync failed for user ${u.steamId}`, e);
      results.push({ user: u.steamId, library: null, error: (e as Error).message });
    }
  }

  return { ok: true, users: activeUsers.length, results };
}

/**
 * Metadata cron entry point: refresh metadata (Store, schema, HLTB) for a
 * bounded set of games that are stale (missing or old `metadata_synced_at`).
 */
export async function runMetadataSync(cfg: BatchConfig = {}): Promise<unknown> {
  if (!db) return { ok: false, reason: 'db-not-configured' };
  const config: Required<BatchConfig> = { ...DEFAULT_CONFIG, ...cfg };

  const ids = await db
    .select({ appid: userGames.appid })
    .from(userGames)
    .limit(config.maxMetadataApps);

  const appids = [...new Set(ids.map((g) => g.appid))];
  const result = await syncMetadata(appids, { force: false });
  return { ok: true, ...result };
}

/**
 * Single-game manual refresh used by `api/games/[appid]/refresh.ts`.
 * Re-syncs metadata (Store, schema, HLTB) and this user's achievement
 * progress for one game, without re-running the whole library.
 */
export async function refreshGame(
  userId: string,
  appid: number,
): Promise<unknown> {
  if (!db) throw new Error('Database not configured');

  const metadataResult = await syncMetadata([appid], { force: true });

  // Clear the per-game "fully synced" marker so the library pass reprocesses
  // just this game's achievements, then run the (idempotent) library sync.
  const ids = await userGameIds(userId, appid);
  if (ids.length > 0) {
    await db.update(userGames).set({ librarySyncedAt: null }).where(inArray(userGames.id, ids));
  }

  const libraryResult = await syncLibrary(userId, { force: false });

  return { metadataResult, libraryResult };
}

async function userGameIds(userId: string, appid: number): Promise<string[]> {
  const rows = await db
    .select({ id: userGames.id })
    .from(userGames)
    .where(and(eq(userGames.userId, userId), eq(userGames.appid, appid)));
  return rows.map((r) => r.id);
}

export type { SyncResult, SyncMetadataResult };
