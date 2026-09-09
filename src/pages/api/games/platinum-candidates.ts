import type { APIRoute } from 'astro';
import { getLibraryGenres, getPlatinumCandidates } from '../../../lib/db/queries/library';

export const prerender = false;

// Returns the FULL candidate set for the signed-in user (one call per visit;
// filtering/sorting happen client-side in LibraryExplorer). Only the base
// semantics are applied here (has achievements + total > 0). Completed (100%)
// games ARE included so the client can decide locally via `showCompleted`.
export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const [games, availableGenres] = await Promise.all([
      getPlatinumCandidates(user.userId, { showCompleted: true }, { key: 'difficulty', direction: 'asc' }),
      getLibraryGenres(user.userId),
    ]);

    return new Response(
      JSON.stringify({
        games,
        meta: { availableGenres },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          // Safe to cache in the browser (Vary: Cookie), NOT at the CDN: the
          // payload is per-user. max-age=300: data only changes on the daily
          // cron, and the client can force-refresh with "Actualizar datos".
          'Cache-Control': 'private, max-age=300',
          Vary: 'Cookie',
        },
      },
    );
  } catch (e) {
    console.error('[platinum-candidates] query failed', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};