import type { APIRoute } from 'astro';
import { getOwnedGames, getPlayerSummaries, resolveVanityUrl } from '../../../lib/steam/webApi';

export const prerender = false;

const STEAMID_RE = /^\d{17}$/;

// Abuse guard for an anonymous endpoint: simple sliding-window per-IP
// limiter. Serverside instances are ephemeral on Vercel, but for a personal
// project this is enough to stop casual hammering of the Steam API.
const IP_WINDOW_MS = 60_000;
const IP_MAX_REQUESTS = 10;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
  if (recent.length >= IP_MAX_REQUESTS) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

/**
 * Parse a Steam profile URL / vanity / raw steamID64 into a SteamID64 string.
 * Returns null when the input is not recognized (not an error: the caller
 * decides whether to try the vanity resolution).
 */
async function resolveSteamId(input: string): Promise<string | null> {
  const raw = input.trim();
  if (STEAMID_RE.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.includes('://') ? raw : `https://steamcommunity.com/${raw.replace(/^\/+/, '')}`);
  } catch {
    return null;
  }
  if (!url.hostname.endsWith('steamcommunity.com')) return null;

  const segs = url.pathname.split('/').filter(Boolean);
  if (segs[0] === 'profiles' && segs[1]) {
    return STEAMID_RE.test(segs[1]) ? segs[1] : null;
  }
  if (segs[0] === 'id' && segs[1]) {
    const res = await resolveVanityUrl(segs[1]);
    return res.response?.success === 1 && res.response.steamid ? res.response.steamid : null;
  }
  // Bare URL forms: steamcommunity.com\/profiles\/<id> or /id/<vanity> handled
  // above; anything else (apps, valvestats…) is not a profile.
  return null;
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

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // Steam data is only fetched because THIS visitor asked for THIS profile.
  const ip = clientAddress ?? 'unknown';
  if (rateLimited(ip)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Espera un momento y vuelve a intentarlo.' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
    );
  }

  let input = '';
  try {
    const body = (await request.json()) as { input?: unknown };
    input = typeof body.input === 'string' ? body.input : '';
  } catch {
    input = '';
  }

  const steamId = await resolveSteamId(input);
  if (!steamId) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'No he entendido ese enlace. Pega la URL de tu perfil de Steam o tu SteamID64.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
    );
  }

  const summaries = await getPlayerSummaries([steamId]);
  const player = summaries.response?.players?.[0];
  if (!player) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Steam no me ha devuelto ningún perfil con ese SteamID.' }),
      { status: 404, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
    );
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

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};