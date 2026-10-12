import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { requireDb } from '../db/client';
import { users, userGames, games } from '../db/schema';
import { syncLibrary, syncLibraryIncremental, type IncrementalSyncResult, type SyncResult } from './syncLibrary';
import { syncMetadata, type SyncMetadataResult } from './syncMetadata';

export interface BatchConfig {
  maxUsers?: number;
  maxAchievementGames?: number;
  maxMetadataApps?: number;
}

export interface DailySyncUserResult {
  user: string;
  library: SyncResult | IncrementalSyncResult | null;
  error?: string;
}

export interface DailySyncSummary {
  ok: true;
  users: number;
  results: DailySyncUserResult[];
}

export type MetadataSyncSummary = { ok: true } & SyncMetadataResult;

export interface RefreshGameResult {
  metadataResult: SyncMetadataResult;
  libraryResult: SyncResult;
}

const DEFAULT_CONFIG: Required<BatchConfig> = {
  maxUsers: 5,
  maxAchievementGames: 40,
  maxMetadataApps: 25,
};

// Cron freshness: re-pull achievement states for games older than 24h each
// daily run. Combined with the batched cap (40/day/user) this rotates through
// the library over time instead of being a one-shot fill.
const CRON_REFRESH_OLDER_THAN_MS = 24 * 60 * 60 * 1000;

/**
 * Daily cron entry point: sync library (owned games + achievements) for a
 * bounded number of users, then queue metadata work for any new games.
 * Idempotent and resumable per-game via `library_synced_at`. Runs a bounded
 * batch per user (config.maxAchievementGames) in REFRESH mode: games never
 * synced or with an error are filled, and games older than 24h are re-pulled,
 * so stale achievement states (SAMP/DLC changes, etc.) rotate to freshness
 * over successive runs instead of staying frozen forever.
 */
export async function runDailySync(cfg: BatchConfig = {}): Promise<DailySyncSummary> {
  const db = requireDb();
  const config: Required<BatchConfig> = { ...DEFAULT_CONFIG, ...cfg };

  const activeUsers = await db
    .select({ id: users.id, steamId: users.steamId })
    .from(users)
    // Least recently synced first (never synced = first) so every user rotates
    // through the daily cap. `last_synced_at` is stamped when a sync completes.
    .orderBy(sql`${users.lastSyncedAt} asc nulls first`, users.id)
    .limit(config.maxUsers);

  const results: DailySyncUserResult[] = [];

  for (const u of activeUsers) {
    try {
      const library = await syncLibraryIncremental(u.id, {
        maxGames: config.maxAchievementGames,
        refreshOlderThanMs: CRON_REFRESH_OLDER_THAN_MS,
      });
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

  const summary: DailySyncSummary = { ok: true, users: activeUsers.length, results };
  console.log('[sync-library]', JSON.stringify(summary));
  return summary;
}

/**
 * Metadata cron entry point: refresh metadata (Store, schema, HLTB) for a
 * bounded set of games that are stale (missing or old `metadata_synced_at`).
 */
export async function runMetadataSync(cfg: BatchConfig = {}): Promise<MetadataSyncSummary> {
  const db = requireDb();
  const config: Required<BatchConfig> = { ...DEFAULT_CONFIG, ...cfg };

  const ids = await db
    .select({ appid: games.appid })
    .from(games)
    .where(isNull(games.metadataSyncedAt))
    .limit(config.maxMetadataApps);

  const appids = ids.map((g) => g.appid);
  const result = await syncMetadata(appids, { force: false });
  const summary: MetadataSyncSummary = { ok: true, ...result };
  console.log('[sync-metadata]', JSON.stringify(summary));
  return summary;
}

/**
 * Single-game manual refresh used by `api/games/[appid]/refresh.ts`.
 * Re-syncs metadata (Store, schema, HLTB) and this user's achievement
 * progress for one game, without re-running the whole library.
 */
export async function refreshGame(
  userId: string,
  appid: number,
): Promise<RefreshGameResult> {
  const db = requireDb();

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
  const rows = await requireDb()
    .select({ id: userGames.id })
    .from(userGames)
    .where(and(eq(userGames.userId, userId), eq(userGames.appid, appid)));
  return rows.map((r) => r.id);
}

export type { SyncResult, SyncMetadataResult };
