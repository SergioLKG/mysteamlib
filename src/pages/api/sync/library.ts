import type { APIRoute } from 'astro';
import { syncLibraryIncremental } from '../../../lib/sync/syncLibrary';

export const prerender = false;

// Staleness threshold for on-demand refreshes: anything a user last synced
// longer ago than this gets re-pulled from Steam on their next visit.
const REFRESH_OLDER_THAN_MS = 6 * 60 * 60 * 1000;
const MAX_GAMES_PER_CHUNK = 12;

/**
 * Runs one bounded batch of the signed-in user's library sync and reports how
 * much work remains. The client (first-load pasarela or on-demand refresh)
 * keeps calling this until `done` is true. Each response answers with the next
 * chunk's status, so a single invocation never exceeds the serverless limit
 * and progress is honest.
 *
 * Mode resolution:
 * - never synced (no library data) → fill mode (imports everything).
 * - already synced but older than 6h → refresh mode (re-pulls stale games).
 * - otherwise → nothing to do, `done: true` immediately.
 */
export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { db } = await import('../../../lib/db/client');
    const { users } = await import('../../../lib/db/schema');
    const { eq } = await import('drizzle-orm');

    const [usr] = await db
      .select({ lastSyncedAt: users.lastSyncedAt })
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1);
    if (!usr) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // First sync ever → import everything (fill). Otherwise only refresh what
    // is stale. Steam data is only fetched because the owner asked for it.
    const firstTime = !usr.lastSyncedAt;
    const result = await syncLibraryIncremental(user.userId, {
      maxGames: MAX_GAMES_PER_CHUNK,
      refreshOlderThanMs: firstTime ? undefined : REFRESH_OLDER_THAN_MS,
    });

    // Games new to the catalog discovered by this chunk need their Store/schema
    // metadata so they can actually appear in the lists (candidates require
    // total_achievements > 0). Metadata is fast and global; keep it bounded.
    if (result.needsMetadata.length > 0) {
      const { syncMetadata } = await import('../../../lib/sync/syncMetadata');
      await syncMetadata(result.needsMetadata.slice(0, 25), { force: false });
    }

    return new Response(
      JSON.stringify({
        mode: firstTime ? 'initial' : 'refresh',
        ...result,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (e) {
    console.error('[sync/library] batch failed', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};