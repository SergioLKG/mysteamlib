import type { APIRoute } from 'astro';
import { SteamRateLimitError, getOwnedGames } from '../../../../lib/steam/webApi';
import { parseProfileInput } from '../../../../lib/steam/profileInput';
import { isRateLimited } from '../../../../lib/db/rateLimit';
import { getCatalogInfo } from '../../../../lib/db/queries/catalog';
import {
  buildPublicLibrary,
  toHours,
  type PublicLibraryGame,
} from '../../../../lib/publicLibrary/view';
import '../../../../lib/sync/steamBudget';

export const prerender = false;

// Same abuse guard as `/api/profiles/lookup` (decision A11), in its own bucket.
// Only cache misses reach the function: the CDN answers repeated requests.
const LIBRARY_RATE_LIMIT = { bucket: 'lookup-library', max: 10, windowSeconds: 60 } as const;

// Public libraries are cacheable per SteamID on the CDN: a repeated lookup of
// the same profile costs no Steam call. 15 minutes fresh, then served stale
// while revalidating in the background.
export const PUBLIC_LIBRARY_CDN_TTL_S = 900;
const PUBLIC_LIBRARY_SWR_S = 3600;

const CACHEABLE = `public, s-maxage=${PUBLIC_LIBRARY_CDN_TTL_S}, stale-while-revalidate=${PUBLIC_LIBRARY_SWR_S}`;

export type PublicLibraryPayload =
  | {
      ok: true;
      steamId: string;
      visibility: 'public';
      gamesCount: number;
      totalHours: number;
      games: PublicLibraryGame[];
    }
  | { ok: true; steamId: string; visibility: 'unreadable' }
  | { ok: false; error: string };

function json(body: PublicLibraryPayload, status: number, cacheControl = 'no-store'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cacheControl },
  });
}

export const GET: APIRoute = async ({ params, clientAddress }) => {
  const parsed = parseProfileInput(params.steamId ?? '');
  // Canonical form only: URL-shaped variants of the same SteamID would
  // fragment the CDN cache and each one would be a miss costing a Steam call.
  if (parsed?.kind !== 'steamid' || parsed.steamId !== params.steamId) {
    return json({ ok: false, error: 'SteamID no válido.' }, 400);
  }
  const steamId = parsed.steamId;

  // Steam data is only fetched because THIS visitor asked for THIS profile.
  if (await isRateLimited(LIBRARY_RATE_LIMIT, clientAddress ?? 'unknown')) {
    return json({ ok: false, error: 'Espera un momento y vuelve a intentarlo.' }, 429);
  }

  try {
    const owned = await getOwnedGames(steamId, { includePlayedFreeGames: true });
    const games = owned.response.games;
    // Private profile, or public profile with hidden game details: Steam
    // returns no `games`. Not cacheable: the owner may change it any minute.
    if (!games) return json({ ok: true, steamId, visibility: 'unreadable' }, 200);

    const { info: catalog, degraded } = await getCatalogInfo(games.map((g) => g.appid));
    const totalMinutes = games.reduce((acc, g) => acc + g.playtime_forever, 0);
    return json(
      {
        ok: true,
        steamId,
        visibility: 'public',
        gamesCount: games.length,
        totalHours: toHours(totalMinutes),
        games: buildPublicLibrary(games, catalog),
      },
      200,
      // A catalog failure yields a library without genres/images: never cache it.
      degraded ? 'no-store' : CACHEABLE,
    );
  } catch (e) {
    // Steam down, rate limited by Valve, or our own daily budget exhausted.
    console.error('public library failed', e);
    if (e instanceof SteamRateLimitError) {
      return json({ ok: false, error: 'Los servidores de Steam están saturados en este momento. Prueba de nuevo más tarde.' }, 503);
    }
    return json({ ok: false, error: 'No he podido consultar Steam ahora mismo. Inténtalo de nuevo en un momento.' }, 502);
  }
};
