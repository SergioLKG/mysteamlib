const STEAMID_RE = /^\d{17}$/;
// Steam custom URLs: 3-32 letters, digits, underscores or hyphens.
const VANITY_RE = /^[A-Za-z0-9_-]{3,32}$/;

export type ProfileInput =
  | { kind: 'steamid'; steamId: string }
  | { kind: 'vanity'; vanity: string };

/**
 * Classify what a visitor pasted: a SteamID64, a bare custom name (`gaben`), a
 * `/profiles/<id>` URL or an `/id/<vanity>` URL. Pure (no Steam calls): the caller resolves vanity names.
 * Returns null when the input is not a recognized profile reference.
 */
export function parseProfileInput(input: string): ProfileInput | null {
  const raw = input.trim();
  if (STEAMID_RE.test(raw)) return { kind: 'steamid', steamId: raw };
  // Digits only but not 17: a mistyped SteamID, not a name worth a vanity lookup.
  if (/^\d+$/.test(raw)) return null;
  if (VANITY_RE.test(raw)) return { kind: 'vanity', vanity: raw };

  // Without a scheme the input is either `host/path` (first segment has a dot)
  // or a bare path like `/id/<vanity>`.
  const bare = raw.replace(/^\/+/, '');
  const hasHost = raw.includes('://') || (!raw.startsWith('/') && bare.split('/')[0].includes('.'));
  let url: URL;
  try {
    url = new URL(raw.includes('://') ? raw : hasHost ? `https://${bare}` : `https://steamcommunity.com/${bare}`);
  } catch {
    return null;
  }
  if (url.hostname !== 'steamcommunity.com' && !url.hostname.endsWith('.steamcommunity.com')) return null;

  const segs = url.pathname.split('/').filter(Boolean);
  if (segs[0] === 'profiles' && segs[1]) {
    return STEAMID_RE.test(segs[1]) ? { kind: 'steamid', steamId: segs[1] } : null;
  }
  if (segs[0] === 'id' && VANITY_RE.test(segs[1] ?? '')) return { kind: 'vanity', vanity: segs[1] };
  // Anything else (apps, valvestats…) is not a profile.
  return null;
}
