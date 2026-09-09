import type { APIRoute } from 'astro';
import { getLibraryGenres, getPlatinumCandidates } from '../../../lib/db/queries/library';
import type {
  PlatinumFilters,
  PlatinumSort,
  ProgressState,
} from '../../../lib/db/queries/library';

export const prerender = false;

function parseIntOrUndefined(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sp = context.url.searchParams;
  const stateRaw = sp.get('state');
  const state: ProgressState =
    stateRaw === 'unplayed' || stateRaw === 'started' || stateRaw === 'completed'
      ? stateRaw
      : 'all';

  const filters: PlatinumFilters = {
    state,
    showCompleted: (sp.get('showCompleted') ?? '') === 'true',
    achievementsMin: parseIntOrUndefined(sp.get('achievementsMin')),
    achievementsMax: parseIntOrUndefined(sp.get('achievementsMax')),
    timeMinHours: parseIntOrUndefined(sp.get('timeMinHours')),
    timeMaxHours: parseIntOrUndefined(sp.get('timeMaxHours')),
    includeNoTime: (sp.get('includeNoTime') ?? 'true') !== 'false',
    genre: sp.get('genre') || undefined,
    search: sp.get('search') || undefined,
  };

  const sortKeyRaw = sp.get('sort');
  const sortKey: PlatinumSort['key'] =
    sortKeyRaw === 'remaining' ||
    sortKeyRaw === 'time' ||
    sortKeyRaw === 'rarity'
      ? sortKeyRaw
      : 'difficulty';
  const sort: PlatinumSort = {
    key: sortKey,
    direction: sp.get('direction') === 'desc' ? 'desc' : 'asc',
  };

  try {
    const [candidates, availableGenres] = await Promise.all([
      getPlatinumCandidates(user.userId, filters, sort),
      getLibraryGenres(user.userId),
    ]);

    return new Response(
      JSON.stringify({
        candidates,
        meta: {
          total: candidates.length,
          partialEstimates: candidates.filter((c) => !c.hasTimeEstimate).length,
          availableGenres,
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
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