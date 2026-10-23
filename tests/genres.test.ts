import { describe, expect, it } from 'vitest';
import {
  GENRE_TITLES,
  NEUTRAL_INK,
  TITLE_MIN_COVERAGE,
  gameInk,
  genreInk,
  genreStats,
  userTitle,
  type GenreGame,
} from '../src/lib/ui/genres';

const g = (hours: number, genres: string[] | null): GenreGame => ({ hours, genres });

describe('gameInk', () => {
  it('takes the most specific coloured genre, not the first listed', () => {
    expect(gameInk(['Action', 'RPG'])).toBe('var(--color-genre-rpg)');
    expect(gameInk(['Indie', 'Action'])).toBe('var(--color-genre-indie)');
  });

  it('falls back to neutral without data or without a coloured genre', () => {
    expect(gameInk(null)).toBe(NEUTRAL_INK);
    expect(gameInk([])).toBe(NEUTRAL_INK);
    expect(gameInk(['Free To Play', 'Sports'])).toBe(NEUTRAL_INK);
  });
});

describe('genreInk', () => {
  it('is neutral for genres without their own ink', () => {
    expect(genreInk('Casual')).toBe('var(--color-genre-casual)');
    expect(genreInk('Racing')).toBe(NEUTRAL_INK);
  });
});

describe('genreStats', () => {
  it('counts a game in every genre it has, so shares can exceed 100 %', () => {
    const stats = genreStats([g(60, ['Action', 'RPG']), g(40, ['Action'])]);
    expect(stats.totalHours).toBe(100);
    expect(stats.genres).toEqual([
      { genre: 'Action', hours: 100, games: 2, share: 1 },
      { genre: 'RPG', hours: 60, games: 1, share: 0.6 },
    ]);
    expect(stats.coverage).toBe(1);
  });

  it('keeps games without genres in the total only', () => {
    const stats = genreStats([g(30, ['Casual']), g(70, null), g(10, [])]);
    expect(stats.totalHours).toBe(110);
    expect(stats.genres).toHaveLength(1);
    expect(stats.coverage).toBeCloseTo(30 / 110);
  });

  it('counts a repeated genre once per game and sorts ties by name', () => {
    const stats = genreStats([g(10, ['Indie', 'Indie']), g(10, ['Action'])]);
    expect(stats.genres.map((s) => [s.genre, s.hours, s.games])).toEqual([
      ['Action', 10, 1],
      ['Indie', 10, 1],
    ]);
  });

  it('handles an empty or zero-hour library', () => {
    expect(genreStats([])).toEqual({ genres: [], totalHours: 0, coverage: 0 });
    const zero = genreStats([g(0, ['Action'])]);
    expect(zero.genres[0].share).toBe(0);
    expect(zero.coverage).toBe(0);
  });
});

describe('userTitle', () => {
  it('names the most played genre and explains the percentage', () => {
    const title = userTitle(genreStats([g(45, ['Casual']), g(55, ['Strategy'])]));
    expect(title?.genre).toBe('Strategy');
    expect(title?.label).toBe(GENRE_TITLES.Strategy);
    expect(title?.percent).toBe(55);
    expect(title?.hint).toContain('55 %');
    expect(title?.hint).toContain('Strategy');
  });

  it('skips a leading genre without nickname', () => {
    const title = userTitle(genreStats([g(80, ['Early Access', 'Casual']), g(5, ['Action'])]));
    expect(title?.genre).toBe('Casual');
  });

  it('gives no title when too few hours have genre data', () => {
    const stats = genreStats([g(10, ['Action']), g(90, null)]);
    expect(stats.coverage).toBeLessThan(TITLE_MIN_COVERAGE);
    expect(userTitle(stats)).toBeNull();
  });

  it('ignores inherited object keys that arrive as genres', () => {
    expect(genreInk('constructor')).toBe(NEUTRAL_INK);
    expect(gameInk(['toString'])).toBe(NEUTRAL_INK);
    expect(userTitle(genreStats([g(10, ['constructor'])]))).toBeNull();
  });

  it('gives no title for an empty library or when no genre has a nickname', () => {
    expect(userTitle(genreStats([]))).toBeNull();
    expect(userTitle(genreStats([g(10, ['Early Access'])]))).toBeNull();
  });
});
