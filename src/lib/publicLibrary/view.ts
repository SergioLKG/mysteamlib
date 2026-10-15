// Pure logic for the public library of the home lookup (decision A9): the
// endpoint builds the list once, the island filters it client-side. No Svelte,
// DOM, DB or `lib/steam` imports (islands cannot import server modules), so the
// input type is declared here.
//
// Same conventions as `src/lib/platinum/view.ts`: exact genre match,
// case-insensitive name search, nulls last, name as tiebreak.

/** Subset of Steam's `GetOwnedGames` entry that this view needs. */
export interface OwnedGameInput {
  appid: number;
  name?: string;
  /** Minutes. */
  playtime_forever: number;
  /** Minutes in the last two weeks. */
  playtime_2weeks?: number;
}

/** What the catalog (`games` table) knows about an app; `null` = «Sin dato». */
export interface CatalogEntry {
  genres: string[] | null;
  headerImageUrl: string | null;
}

export interface PublicLibraryGame {
  appid: number;
  name: string;
  hours: number;
  recentHours: number;
  genres: string[] | null;
  headerImageUrl: string | null;
}

export type PublicLibraryState = 'all' | 'played' | 'unplayed' | 'recent';
export type PublicLibrarySort = 'hours' | 'name' | 'recent';

export interface PublicLibraryFilters {
  /** Exact genre; empty = any. Games without genre data never match. */
  genre: string;
  state: PublicLibraryState;
  sort: PublicLibrarySort;
  /** Case-insensitive substring of the name. */
  query: string;
}

/** Games rendered per batch by the island (A9: no server-side pagination). */
export const LIBRARY_PAGE_SIZE = 48;
/** Genre chips shown above the list. */
export const GENRE_CHIPS_LIMIT = 8;

/** Minutes to hours with one decimal. */
export function toHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

export function buildPublicLibrary(
  owned: readonly OwnedGameInput[],
  catalog: ReadonlyMap<number, CatalogEntry>,
): PublicLibraryGame[] {
  return owned.map((g) => {
    const info = catalog.get(g.appid);
    return {
      appid: g.appid,
      name: g.name ?? `App ${g.appid}`,
      hours: toHours(g.playtime_forever),
      recentHours: toHours(g.playtime_2weeks ?? 0),
      genres: info?.genres ?? null,
      headerImageUrl: info?.headerImageUrl ?? null,
    };
  });
}

function cmpName(a: PublicLibraryGame, b: PublicLibraryGame): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

export function filterPublicLibrary(
  games: readonly PublicLibraryGame[],
  f: PublicLibraryFilters,
): PublicLibraryGame[] {
  const q = f.query.trim().toLowerCase();
  const list = games.filter((g) => {
    if (f.state === 'played' && g.hours === 0) return false;
    if (f.state === 'unplayed' && g.hours !== 0) return false;
    if (f.state === 'recent' && g.recentHours === 0) return false;
    if (f.genre && !g.genres?.includes(f.genre)) return false;
    if (q && !g.name.toLowerCase().includes(q)) return false;
    return true;
  });

  list.sort((a, b) => {
    if (f.sort === 'name') return cmpName(a, b);
    const by = f.sort === 'recent' ? b.recentHours - a.recentHours : b.hours - a.hours;
    return by !== 0 ? by : cmpName(a, b);
  });
  return list;
}

/**
 * Most frequent genres of the library, for the filter chips: count desc, name
 * as tiebreak. Games without genre data contribute nothing.
 */
export function topGenres(games: readonly PublicLibraryGame[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const g of games) {
    for (const genre of new Set(g.genres)) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, limit)
    .map(([genre]) => genre);
}
