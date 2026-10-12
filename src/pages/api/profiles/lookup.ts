import type { APIRoute } from 'astro';
import {
  SteamRateLimitError,
  getOwnedGames,
  getPlayerSummaries,
  resolveVanityUrl,
} from '../../../lib/steam/webApi';
import { parseProfileInput } from '../../../lib/steam/profileInput';
import { isRateLimited } from '../../../lib/db/rateLimit';
import '../../../lib/sync/steamBudget';

export const prerender = false;

// Abuse guard for an anonymous endpoint: per-IP fixed window persisted in Neon
// (`lib/db/rateLimit.ts`, decision A11), so it holds across cold starts and
// instances.
const LOOKUP_RATE_LIMIT = { bucket: 'lookup', max: 10, windowSeconds: 60 } as const;

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

/**
 * Resolve what the visitor pasted into a SteamID64. Returns null when the
 * input is not recognized (not an error: the caller answers 400).
 */
async function resolveSteamId(input: string): Promise<string | null> {
  const parsed = parseProfileInput(input);
  if (!parsed) return null;
  if (parsed.kind === 'steamid') return parsed.steamId;
  const res = await resolveVanityUrl(parsed.vanity);
  return res.response?.success === 1 && res.response.steamid ? res.response.steamid : null;
}

export type ProfileLookupPayload =
  | {
      ok: true;
      steamId: string;
      personaName: string;
      avatarUrl: string | null;
      profileUrl: string;
      visibility: 'public' | 'private' | 'unreadable';
      // Only present when the profile is public:
      gamesCount?: number;
      totalHours?: number;
      topGames?: { appid: number; name: string; hours: number }[];
    }
  | { ok: false; error: string };

function json(body: ProfileLookupPayload, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // Steam data is only fetched because THIS visitor asked for THIS profile.
  const ip = clientAddress ?? 'unknown';
  if (await isRateLimited(LOOKUP_RATE_LIMIT, ip)) {
    return json({ ok: false, error: 'Espera un momento y vuelve a intentarlo.' }, 429);
  }

  let input = '';
  try {
    const body = (await request.json()) as { input?: unknown };
    input = typeof body.input === 'string' ? body.input : '';
  } catch {
    input = '';
  }

  try {
    const steamId = await resolveSteamId(input);
    if (!steamId) {
      return json(
        {
          ok: false,
          error: 'No he entendido ese enlace. Pega la URL de tu perfil de Steam o tu SteamID64.',
        },
        400,
      );
    }

    const summaries = await getPlayerSummaries([steamId]);
    const player = summaries.response?.players?.[0];
    if (!player) {
      return json({ ok: false, error: 'Steam no me ha devuelto ningún perfil con ese SteamID.' }, 404);
    }

    const payload: ProfileLookupPayload = {
      ok: true,
      steamId,
      personaName: player.personaname ?? '—',
      avatarUrl: player.avatarfull ?? null,
      profileUrl: player.profileurl ?? `https://steamcommunity.com/profiles/${steamId}`,
      visibility: player.communityvisibilitystate === 3 ? 'public' : 'private',
    };

    // Private profiles deny everything: never waste API calls on them.
    if (payload.visibility === 'public') {
      const owned = await getOwnedGames(steamId, { includePlayedFreeGames: true });
      const games = owned.response.games ?? [];
      const sorted = [...games].filter((g) => g.playtime_forever > 0).sort(
        (a, b) => b.playtime_forever - a.playtime_forever,
      );
      payload.gamesCount = owned.response.game_count;
      payload.totalHours = Math.round(games.reduce((acc, g) => acc + g.playtime_forever, 0) / 6) / 10;
      payload.topGames = sorted.slice(0, 5).map((g) => ({
        appid: g.appid,
        name: g.name ?? `App ${g.appid}`,
        hours: Math.round((g.playtime_forever / 60) * 10) / 10,
      }));
    }

    return json(payload, 200);
  } catch (e) {
    // Steam down, rate limited by Valve, or our own daily budget exhausted.
    console.error('profile lookup failed', e);
    if (e instanceof SteamRateLimitError) {
      return json({ ok: false, error: 'Steam está recibiendo demasiadas consultas. Inténtalo de nuevo en unos minutos.' }, 503);
    }
    return json({ ok: false, error: 'No he podido consultar Steam ahora mismo. Inténtalo de nuevo en un momento.' }, 502);
  }
};
