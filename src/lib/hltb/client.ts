import { HLTBClient } from 'hltb-client';

export type HltbMatchConfidence = 'exact' | 'fuzzy' | 'manual_override' | 'not_found';

export interface HltbMatch {
  hltbId: string | null;
  mainStoryHours: number | null;
  mainExtraHours: number | null;
  completionistHours: number | null;
  matchConfidence: HltbMatchConfidence;
}

const client = new HLTBClient({ platform: 'PC' });

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Fuzzy match against HowLongToBeat.
 * Strategy per 02 §5: exact name match first; if the top result is a strong
 * fuzz match, mark 'fuzzy'; otherwise 'not_found'. Never throws — a failure
 * to reach HLTB returns not_found so it never blocks the rest of a sync run.
 */
export async function searchGame(gameName: string): Promise<HltbMatch> {
  const notFound: HltbMatch = {
    hltbId: null,
    mainStoryHours: null,
    mainExtraHours: null,
    completionistHours: null,
    matchConfidence: 'not_found',
  };

  try {
    const results = await client.search(normalize(gameName), { limit: 5 });
    if (!results || results.length === 0) {
      return notFound;
    }

    const top = results[0];
    const exact = normalize(top.name) === normalize(gameName);
    // Conservative fuzzy threshold on normalized names
    const fuzzyMatch = isFuzzyClose(top.name, gameName);

    if (exact) {
      return toMatch(top, 'exact');
    }
    if (fuzzyMatch) {
      return toMatch(top, 'fuzzy');
    }
    return notFound;
  } catch (err) {
    // HLTB scraping is fragile; never let it take down the sync job.
    console.error('HLTB search failed for', gameName, err);
    return notFound;
  }
}

function isFuzzyClose(candidate: string, target: string): boolean {
  const a = normalize(candidate).split(' ').filter(Boolean);
  const b = normalize(target).split(' ').filter(Boolean);
  if (a.length === 0 || b.length === 0) return false;

  // Require all words of the shorter name to appear in the longer one (conservative).
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.every((w) => longer.includes(w));
}

function toMatch(
  result: { id: string; name: string; completionTimes: { main?: number; mainExtra?: number; completionist?: number } },
  confidence: 'exact' | 'fuzzy',
): HltbMatch {
  return {
    hltbId: result.id,
    mainStoryHours: result.completionTimes.main ?? null,
    mainExtraHours: result.completionTimes.mainExtra ?? null,
    completionistHours: result.completionTimes.completionist ?? null,
    matchConfidence: confidence,
  };
}
