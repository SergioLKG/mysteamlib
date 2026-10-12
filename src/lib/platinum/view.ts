// Client-side view logic for /platino: filters and sorting over the full
// per-user dataset. Pure functions, no Svelte or DOM.
//
// KEEP SEMANTICALLY IDENTICAL to `src/lib/db/queries/library.ts` (the SQL
// version used by the API): same state filters, exact genre match,
// case-insensitive name search, nulls always last, name as tiebreak.

export interface Candidate {
  appid: number;
  name: string;
  headerImageUrl: string | null;
  genres: string[] | null;
  releaseDate: string | null;
  achievementsUnlocked: number;
  totalAchievements: number;
  achievementsRemaining: number;
  completionPercent: number;
  playtimeMinutes: number;
  estimatedTimeToPlatinum: number | null;
  hasTimeEstimate: boolean;
  avgGlobalRarityRemaining: number | null;
  difficultyScore: number;
}

export interface Filters {
  search: string;
  progress: string;
  showCompleted: boolean;
  achievementsMin: number;
  achievementsMax: number;
  timeMin: number;
  timeMax: number;
  includeNoTime: boolean;
  genre: string;
  sort: string;
  direction: string;
}

// Caps for the dual-range sliders (min always 0). A value at the cap means
// "no limit".
export const ACH_MAX = 150;
export const TIME_MAX = 500;

export function cmpName(a: Candidate, b: Candidate): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

export function cmpNullsLast(a: number | null, b: number | null, asc: boolean): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return asc ? a - b : b - a;
}

export function buildView(all: Candidate[], f: Filters): Candidate[] {
  const q = f.search.trim().toLowerCase();
  const timeMin = f.timeMin > 0 ? f.timeMin : undefined;
  const timeMax = f.timeMax < TIME_MAX ? f.timeMax : undefined;
  const remMin = f.achievementsMin > 0 ? f.achievementsMin : undefined;
  const remMax = f.achievementsMax < ACH_MAX ? f.achievementsMax : undefined;
  const showCompleted = f.showCompleted || f.progress === 'completed';

  const list: Candidate[] = [];
  for (const c of all) {
    const rem = c.achievementsRemaining;
    if (!showCompleted && rem === 0) continue;
    if (f.progress === 'unplayed' && c.playtimeMinutes !== 0) continue;
    if (f.progress === 'started' && !(c.achievementsUnlocked > 0 && rem > 0)) continue;
    if (f.progress === 'completed' && rem !== 0) continue;
    if (!f.includeNoTime && !c.hasTimeEstimate) continue;
    if (f.genre && !c.genres?.includes(f.genre)) continue;
    if (q && !c.name.toLowerCase().includes(q)) continue;
    if (remMin !== undefined && rem < remMin) continue;
    if (remMax !== undefined && rem > remMax) continue;
    if (timeMin !== undefined && (c.estimatedTimeToPlatinum === null || c.estimatedTimeToPlatinum < timeMin)) continue;
    if (timeMax !== undefined && (c.estimatedTimeToPlatinum === null || c.estimatedTimeToPlatinum > timeMax)) continue;
    list.push(c);
  }

  const asc = f.direction !== 'desc';
  const valueFn = (c: Candidate): number | null => {
    switch (f.sort) {
      case 'remaining':
        return c.achievementsRemaining;
      case 'time':
        return c.estimatedTimeToPlatinum;
      case 'rarity':
        return c.avgGlobalRarityRemaining;
      case 'difficulty':
      default:
        return c.difficultyScore;
    }
  };
  list.sort((a, b) => {
    const by = cmpNullsLast(valueFn(a), valueFn(b), asc);
    return by !== 0 ? by : cmpName(a, b);
  });
  return list;
}
