import { HowLongToBeatService, SearchModifier } from 'howlongtobeat-ts';

export type HltbMatchConfidence = 'exact' | 'fuzzy' | 'manual_override' | 'not_found';

export interface HltbMatch {
  hltbId: string | null;
  mainStoryHours: number | null;
  mainExtraHours: number | null;
  completionistHours: number | null;
  matchConfidence: HltbMatchConfidence;
}

// HLTB has no public API and no published rate limit, so we stay polite:
// one request at a time plus a small in-memory cache so repeated lookups of the
// same title inside a sync run (or a manual backfill) cost nothing.
// Override the pace for bulk work with HLTB_MIN_INTERVAL_MS (e.g. 2000).
const MIN_INTERVAL_MS = Number(process.env.HLTB_MIN_INTERVAL_MS ?? 1200);
let lastRequestAt = 0;

const cache = new Map<string, HltbMatch>();
const CACHE_MAX = 500;

// Conservative by design: a wrong time is worse than "Sin dato" (see docs 04).
// A fuzzy match needs the library similarity score AND every word of the shorter
// title to be present in the longer one.
const FUZZY_THRESHOLD = 0.85;

const service = new HowLongToBeatService();

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isFuzzyClose(candidate: string, target: string): boolean {
  const a = normalize(candidate).split(' ').filter(Boolean);
  const b = normalize(target).split(' ').filter(Boolean);
  if (a.length === 0 || b.length === 0) return false;

  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.every((w) => longer.includes(w));
}

function secondsToHours(seconds: number | null | undefined): number | null {
  if (seconds === null || seconds === undefined) return null;
  const hours = seconds / 3600;
  if (!Number.isFinite(hours) || hours <= 0) return null;
  return Math.round(hours * 10) / 10;
}

async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

const notFound: HltbMatch = {
  hltbId: null,
  mainStoryHours: null,
  mainExtraHours: null,
  completionistHours: null,
  matchConfidence: 'not_found',
};

interface HltbResult {
  id: number;
  name: string;
  type?: string;
  mainTime?: number;
  mainExtraTime?: number;
  completionistTime?: number;
  similarity?: number;
}

/**
 * Match a game title against HowLongToBeat and return its completion times.
 *
 * Strategy (docs 04): exact normalized-name match wins; otherwise a fuzzy match
 * only when the library similarity clears the conservative threshold; anything
 * else is reported as `not_found` so the UI shows "Sin dato" instead of a
 * possibly wrong number.
 *
 * Never throws: HLTB is an unofficial scrape that breaks without notice, and a
 * failure here must never take down a sync run.
 */
export async function searchGame(gameName: string): Promise<HltbMatch> {
  const key = normalize(gameName);
  if (!key) return notFound;

  const cached = cache.get(key);
  if (cached) return cached;

  try {
    await throttle();
    const res = await service.search(gameName, { modifier: SearchModifier.HIDE_DLC });
    if (!res.success || res.data.length === 0) return remember(key, notFound);

    // Ignore DLC/expansion entries even if the filter let one through.
    const candidates = res.data.filter((r) => (r.type ?? 'game') === 'game');
    if (candidates.length === 0) return remember(key, notFound);

    const top = candidates[0] as HltbResult;

    if (normalize(top.name) === key) {
      return remember(key, toMatch(top, 'exact'));
    }

    const similarity = top.similarity ?? 0;
    if (similarity >= FUZZY_THRESHOLD && isFuzzyClose(top.name, gameName)) {
      return remember(key, toMatch(top, 'fuzzy'));
    }

    return remember(key, notFound);
  } catch (err) {
    console.error('[hltb] search failed for', gameName, err instanceof Error ? err.message : err);
    return notFound;
  }
}

function remember(key: string, match: HltbMatch): HltbMatch {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, match);
  return match;
}

function toMatch(result: HltbResult, matchConfidence: 'exact' | 'fuzzy'): HltbMatch {
  return {
    hltbId: String(result.id),
    mainStoryHours: secondsToHours(result.mainTime),
    mainExtraHours: secondsToHours(result.mainExtraTime),
    completionistHours: secondsToHours(result.completionistTime),
    matchConfidence,
  };
}

/** Exposed for diagnostics: the threshold currently in use. */
export const HLTB_FUZZY_THRESHOLD = FUZZY_THRESHOLD;
