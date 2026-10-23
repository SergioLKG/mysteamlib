// Pure logic behind genre colours, the genre legend and the user title (docs/features/estanteria-y-titulos.md).
// No Svelte, DOM or DB imports: islands import it.

export interface GenreGame {
  hours: number;
  genres?: readonly string[] | null;
}

/** Genres with their own ink, most specific first: a game takes the first one it has. */
export const GENRE_COLOR_PRIORITY = ['RPG', 'Strategy', 'Simulation', 'Adventure', 'Casual', 'Indie', 'Action'] as const;
export type ColoredGenre = (typeof GENRE_COLOR_PRIORITY)[number];

const GENRE_INK: Record<ColoredGenre, string> = {
  RPG: 'var(--color-genre-rpg)',
  Strategy: 'var(--color-genre-strategy)',
  Simulation: 'var(--color-genre-simulation)',
  Adventure: 'var(--color-genre-adventure)',
  Casual: 'var(--color-genre-casual)',
  Indie: 'var(--color-genre-indie)',
  Action: 'var(--color-genre-action)',
};
/** Genres without their own ink (Free To Play, Sports…) and games without data. */
export const NEUTRAL_INK = 'var(--color-spine-played)';

function isColored(genre: string): genre is ColoredGenre {
  // `in` would also match inherited keys ("constructor") that arrive in external data.
  return Object.hasOwn(GENRE_INK, genre);
}

export function genreInk(genre: string): string {
  return isColored(genre) ? GENRE_INK[genre] : NEUTRAL_INK;
}

/** Ink of a game: its most specific coloured genre, neutral when it has none. */
export function gameInk(genres: readonly string[] | null | undefined): string {
  if (!genres) return NEUTRAL_INK;
  const first = GENRE_COLOR_PRIORITY.find((g) => genres.includes(g));
  return first ? GENRE_INK[first] : NEUTRAL_INK;
}

export interface GenreStat {
  genre: string;
  hours: number;
  games: number;
  /** Fraction of the library's total hours (0..1). */
  share: number;
}

export interface GenreStats {
  /** Hours desc, name as tiebreak. */
  genres: GenreStat[];
  totalHours: number;
  /** Fraction of the total hours that belongs to games with genre data (0..1). */
  coverage: number;
}

/**
 * Hours per genre. A game's hours count in EVERY genre it has, so shares can add up to more
 * than 100 %; games without genres count only in the total.
 */
export function genreStats(games: readonly GenreGame[]): GenreStats {
  const byGenre = new Map<string, { hours: number; games: number }>();
  let totalHours = 0;
  let coveredHours = 0;
  for (const g of games) {
    totalHours += g.hours;
    if (!g.genres || g.genres.length === 0) continue;
    coveredHours += g.hours;
    for (const genre of new Set(g.genres)) {
      const entry = byGenre.get(genre) ?? { hours: 0, games: 0 };
      entry.hours += g.hours;
      entry.games += 1;
      byGenre.set(genre, entry);
    }
  }
  const genres = [...byGenre]
    .map(([genre, e]) => ({ genre, hours: e.hours, games: e.games, share: totalHours > 0 ? e.hours / totalHours : 0 }))
    .sort((a, b) => b.hours - a.hours || (a.genre < b.genre ? -1 : a.genre > b.genre ? 1 : 0));
  return { genres, totalHours, coverage: totalHours > 0 ? coveredHours / totalHours : 0 };
}

/** Nicknames by genre. Genres missing here give no title. */
export const GENRE_TITLES: Record<string, string> = {
  Action: 'Mercenario',
  RPG: 'Héroe',
  Strategy: 'Estratega',
  Simulation: 'Ingeniero',
  Adventure: 'Explorador',
  Casual: 'Civil',
  Indie: 'Buscatesoros',
  'Free To Play': 'Sin blanca',
  Sports: 'Deportista',
  Racing: 'Piloto',
  'Massively Multiplayer': 'Aliado',
};

/** Below this share of hours with genre data a title would be a guess, so none is given. */
export const TITLE_MIN_COVERAGE = 0.5;

export interface UserTitle {
  label: string;
  genre: string;
  /** Whole percent of the total hours. */
  percent: number;
  hint: string;
}

/** Title of the genre with the most hours; `null` if the data does not support it. */
export function userTitle(stats: GenreStats): UserTitle | null {
  if (stats.coverage < TITLE_MIN_COVERAGE) return null;
  // The most played genre that has a nickname (an unnamed leader would hide a valid second).
  const top = stats.genres.find((g) => Object.hasOwn(GENRE_TITLES, g.genre));
  if (!top) return null;
  const percent = Math.round(top.share * 100);
  return {
    label: GENRE_TITLES[top.genre],
    genre: top.genre,
    percent,
    // Neutral voice: the public lookup shows other people's profiles, not only the visitor's.
    hint: `El ${percent} % de las horas son en juegos con la etiqueta ${top.genre}. Es el género más jugado.`,
  };
}
