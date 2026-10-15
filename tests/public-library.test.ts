import { describe, expect, it } from 'vitest';
import {
  buildPublicLibrary,
  filterPublicLibrary,
  toHours,
  topGenres,
  type CatalogEntry,
  type PublicLibraryFilters,
  type PublicLibraryGame,
} from '../src/lib/publicLibrary/view';

function game(over: Partial<PublicLibraryGame> & { appid: number; name: string }): PublicLibraryGame {
  return { hours: 0, recentHours: 0, genres: null, headerImageUrl: null, ...over };
}

const DEFAULTS: PublicLibraryFilters = { genre: '', state: 'all', sort: 'hours', query: '' };
const names = (list: PublicLibraryGame[]) => list.map((g) => g.name);

describe('toHours', () => {
  it('rounds minutes to one decimal', () => {
    expect(toHours(0)).toBe(0);
    expect(toHours(90)).toBe(1.5);
    expect(toHours(100)).toBe(1.7);
  });
});

describe('buildPublicLibrary', () => {
  const catalog = new Map<number, CatalogEntry>([
    [1, { genres: ['Action'], headerImageUrl: 'https://img/1.jpg' }],
    [2, { genres: null, headerImageUrl: null }],
  ]);

  it('merges catalog data and converts minutes to hours', () => {
    const [g] = buildPublicLibrary([{ appid: 1, name: 'A', playtime_forever: 90, playtime_2weeks: 30 }], catalog);
    expect(g).toEqual({
      appid: 1,
      name: 'A',
      hours: 1.5,
      recentHours: 0.5,
      genres: ['Action'],
      headerImageUrl: 'https://img/1.jpg',
    });
  });

  it('uses null for games missing from the catalog and a fallback name', () => {
    const [g] = buildPublicLibrary([{ appid: 99, playtime_forever: 0 }], catalog);
    expect(g.name).toBe('App 99');
    expect(g.genres).toBeNull();
    expect(g.headerImageUrl).toBeNull();
    expect(g.recentHours).toBe(0);
  });

  it('keeps null genres for catalog entries without data', () => {
    const [g] = buildPublicLibrary([{ appid: 2, name: 'B', playtime_forever: 10 }], catalog);
    expect(g.genres).toBeNull();
  });
});

describe('filterPublicLibrary', () => {
  const lib = [
    game({ appid: 1, name: 'Alpha', hours: 10, recentHours: 0, genres: ['Action'] }),
    game({ appid: 2, name: 'Beta', hours: 0, genres: ['RPG', 'Action'] }),
    game({ appid: 3, name: 'Gamma', hours: 5, recentHours: 2, genres: null }),
    game({ appid: 4, name: 'Delta', hours: 5, recentHours: 1, genres: ['RPG'] }),
  ];

  it('state filters', () => {
    expect(names(filterPublicLibrary(lib, { ...DEFAULTS, state: 'played' }))).toEqual(['Alpha', 'Delta', 'Gamma']);
    expect(names(filterPublicLibrary(lib, { ...DEFAULTS, state: 'unplayed' }))).toEqual(['Beta']);
    expect(names(filterPublicLibrary(lib, { ...DEFAULTS, state: 'recent' }))).toEqual(['Delta', 'Gamma']);
  });

  it('genre filter is exact and excludes games without genre data', () => {
    expect(names(filterPublicLibrary(lib, { ...DEFAULTS, genre: 'RPG', sort: 'name' }))).toEqual(['Beta', 'Delta']);
    expect(names(filterPublicLibrary(lib, { ...DEFAULTS, genre: 'rpg' }))).toEqual([]);
  });

  it('query is a case-insensitive substring of the name', () => {
    expect(names(filterPublicLibrary(lib, { ...DEFAULTS, query: '  TA ', sort: 'name' }))).toEqual(['Beta', 'Delta']);
  });

  it('sorts by hours desc with name as tiebreak', () => {
    expect(names(filterPublicLibrary(lib, DEFAULTS))).toEqual(['Alpha', 'Delta', 'Gamma', 'Beta']);
  });

  it('sorts by recent hours desc, then name', () => {
    expect(names(filterPublicLibrary(lib, { ...DEFAULTS, sort: 'recent' }))).toEqual(['Gamma', 'Delta', 'Alpha', 'Beta']);
  });

  it('sorts by name asc', () => {
    expect(names(filterPublicLibrary(lib, { ...DEFAULTS, sort: 'name' }))).toEqual(['Alpha', 'Beta', 'Delta', 'Gamma']);
  });

  it('does not mutate the input', () => {
    const copy = [...lib];
    filterPublicLibrary(lib, { ...DEFAULTS, sort: 'name' });
    expect(lib).toEqual(copy);
  });
});

describe('topGenres', () => {
  const lib = [
    game({ appid: 1, name: 'A', genres: ['Action', 'RPG'] }),
    game({ appid: 2, name: 'B', genres: ['RPG'] }),
    game({ appid: 3, name: 'C', genres: ['Indie', 'Action'] }),
    game({ appid: 4, name: 'D', genres: null }),
  ];

  it('orders by frequency desc with name as tiebreak', () => {
    expect(topGenres(lib, 10)).toEqual(['Action', 'RPG', 'Indie']);
  });

  it('counts a genre once per game', () => {
    const dup = [game({ appid: 1, name: 'A', genres: ['RPG', 'RPG'] }), game({ appid: 2, name: 'B', genres: ['Indie'] })];
    expect(topGenres(dup, 10)).toEqual(['Indie', 'RPG']);
  });

  it('applies the limit and ignores games without genre data', () => {
    expect(topGenres(lib, 1)).toEqual(['Action']);
    expect(topGenres([game({ appid: 5, name: 'E' })], 5)).toEqual([]);
  });
});
