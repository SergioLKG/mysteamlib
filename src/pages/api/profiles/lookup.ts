import type { APIRoute } from 'astro';
import { SteamAuthError, SteamRateLimitError, getPlayerSummaries, resolveVanityUrl } from '../../../lib/steam/webApi';
import { parseProfileInput } from '../../../lib/steam/profileInput';
import { isRateLimited } from '../../../lib/db/rateLimit';
import '../../../lib/sync/steamBudget';

export const prerender = false;

// Profile summary only (one or two Steam calls, `no-store`). The library lives
// in `GET /api/profiles/[steamId]/library`, which the CDN can cache per SteamID.

// Abuse guard for an anonymous endpoint: per-IP fixed window persisted in Neon
// (`lib/db/rateLimit.ts`, decision A11), so it holds across cold starts and
// instances.
const LOOKUP_RATE_LIMIT = { bucket: 'lookup', max: 10, windowSeconds: 60 } as const;

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

const NOT_FOUND_MESSAGE =
  'No encuentro ese perfil. Revisa que el nombre o el SteamID estén bien escritos, o pega la URL completa.';

/** Custom name → SteamID64, or null when no profile uses it. */
async function resolveVanity(vanity: string): Promise<string | null> {
  const res = await resolveVanityUrl(vanity);
  return res.response?.success === 1 && res.response.steamid ? res.response.steamid : null;
}

export type ProfileLookupPayload =
  | {
      ok: true;
      steamId: string;
      personaName: string;
      avatarUrl: string | null;
      profileUrl: string;
      // `public` here only means the profile page is public: the library may
      // still be hidden (the library endpoint answers `unreadable`).
      visibility: 'public' | 'private';
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
    const parsed = parseProfileInput(input);
    if (!parsed) {
      return json(
        {
          ok: false,
          error: 'Eso no parece un perfil de Steam. Prueba con la URL de tu perfil, tu nick o tu SteamID64.',
        },
        400,
      );
    }
    const steamId = parsed.kind === 'steamid' ? parsed.steamId : await resolveVanity(parsed.vanity);
    if (!steamId) return json({ ok: false, error: NOT_FOUND_MESSAGE }, 404);

    const summaries = await getPlayerSummaries([steamId]);
    const player = summaries.response?.players?.[0];
    if (!player) return json({ ok: false, error: NOT_FOUND_MESSAGE }, 404);

    return json(
      {
        ok: true,
        steamId,
        personaName: player.personaname ?? '—',
        avatarUrl: player.avatarfull ?? null,
        profileUrl: player.profileurl ?? `https://steamcommunity.com/profiles/${steamId}`,
        visibility: player.communityvisibilitystate === 3 ? 'public' : 'private',
      },
      200,
    );
  } catch (e) {
    // Steam down, rate limited by Valve, or our own daily budget exhausted.
    console.error('profile lookup failed', e);
    if (e instanceof SteamRateLimitError) {
      return json({ ok: false, error: 'Los servidores de Steam están saturados en este momento. Prueba de nuevo más tarde.' }, 503);
    }
    if (e instanceof SteamAuthError) {
      return json({ ok: false, error: 'Hay un problema de configuración en mysteamlib y no puedo consultar Steam ahora mismo. Ya está en nuestro radar; inténtalo de nuevo más tarde.' }, 500);
    }
    return json({ ok: false, error: 'No he podido consultar Steam ahora mismo. Inténtalo de nuevo en un momento.' }, 502);
  }
};
