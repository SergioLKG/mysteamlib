import { describe, expect, it } from 'vitest';
import {
  ACH_MAX,
  TIME_MAX,
  buildView,
  cmpNullsLast,
  type Candidate,
  type Filters,
} from '../src/lib/platinum/view';

function game(over: Partial<Candidate> & { appid: number; name: string }): Candidate {
  return {
    headerImageUrl: null,
    genres: null,
    releaseDate: null,
    achievementsUnlocked: 0,
    totalAchievements: 10,
    achievementsRemaining: 10,
    completionPercent: 0,
    playtimeMinutes: 0,
    estimatedTimeToPlatinum: null,
    hasTimeEstimate: false,
    avgGlobalRarityRemaining: null,
    difficultyScore: 50,
    ...over,
  };
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  progress: 'all',
  showCompleted: false,
  achievementsMin: 0,
  achievementsMax: ACH_MAX,
  timeMin: 0,
  timeMax: TIME_MAX,
  includeNoTime: true,
  genre: '',
  sort: 'difficulty',
  direction: 'asc',
};
const f = (over: Partial<Filters> = {}): Filters => ({ ...DEFAULT_FILTERS, ...over });
const names = (list: Candidate[]) => list.map((c) => c.name);

describe('buildView filters', () => {
  const library = [
    game({ appid: 1, name: 'Unplayed', playtimeMinutes: 0, achievementsRemaining: 10 }),
    game({ appid: 2, name: 'Started', playtimeMinutes: 90, achievementsUnlocked: 3, achievementsRemaining: 7 }),
    game({ appid: 3, name: 'Done', playtimeMinutes: 600, achievementsUnlocked: 10, achievementsRemaining: 0 }),
  ];

  it('hides completed games by default', () => {
    expect(names(buildView(library, f()))).not.toContain('Done');
  });

  it('shows completed games with showCompleted or the completed state', () => {
    expect(names(buildView(library, f({ showCompleted: true })))).toContain('Done');
    expect(names(buildView(library, f({ progress: 'completed' })))).toEqual(['Done']);
  });

  it('filters unplayed and started', () => {
    expect(names(buildView(library, f({ progress: 'unplayed' })))).toEqual(['Unplayed']);
    expect(names(buildView(library, f({ progress: 'started' })))).toEqual(['Started']);
  });

  it('matches the name case-insensitively as a substring', () => {
    expect(names(buildView(library, f({ search: '  sTaRt ' })))).toEqual(['Started']);
  });

  it('matches genres exactly', () => {
    const list = [
      game({ appid: 1, name: 'A', genres: ['Action', 'RPG'] }),
      game({ appid: 2, name: 'B', genres: ['Action RPG'] }),
      game({ appid: 3, name: 'C', genres: null }),
    ];
    expect(names(buildView(list, f({ genre: 'Action' })))).toEqual(['A']);
  });

  it('applies the remaining-achievements range only below/above the caps', () => {
    expect(names(buildView(library, f({ achievementsMin: 8 })))).toEqual(['Unplayed']);
    expect(names(buildView(library, f({ achievementsMax: 8 })))).toEqual(['Started']);
    expect(buildView(library, f({ achievementsMax: ACH_MAX }))).toHaveLength(2);
  });

  it('excludes unknown times from any time range and from includeNoTime=false', () => {
    const list = [
      game({ appid: 1, name: 'Known', estimatedTimeToPlatinum: 5, hasTimeEstimate: true }),
      game({ appid: 2, name: 'Unknown' }),
    ];
    expect(names(buildView(list, f()))).toEqual(['Known', 'Unknown']);
    expect(names(buildView(list, f({ includeNoTime: false })))).toEqual(['Known']);
    expect(names(buildView(list, f({ timeMin: 1 })))).toEqual(['Known']);
    expect(names(buildView(list, f({ timeMax: 10 })))).toEqual(['Known']);
    expect(names(buildView(list, f({ timeMin: 6 })))).toEqual([]);
  });
});

describe('buildView sorting', () => {
  it('sorts by difficulty ascending with the name as tiebreak', () => {
    const list = [
      game({ appid: 1, name: 'B', difficultyScore: 20 }),
      game({ appid: 2, name: 'A', difficultyScore: 20 }),
      game({ appid: 3, name: 'C', difficultyScore: 10 }),
    ];
    expect(names(buildView(list, f()))).toEqual(['C', 'A', 'B']);
    expect(names(buildView(list, f({ direction: 'desc' })))).toEqual(['A', 'B', 'C']);
  });

  it('keeps null values last in both directions', () => {
    const list = [
      game({ appid: 1, name: 'None' }),
      game({ appid: 2, name: 'Low', estimatedTimeToPlatinum: 2, hasTimeEstimate: true }),
      game({ appid: 3, name: 'High', estimatedTimeToPlatinum: 40, hasTimeEstimate: true }),
    ];
    expect(names(buildView(list, f({ sort: 'time' })))).toEqual(['Low', 'High', 'None']);
    expect(names(buildView(list, f({ sort: 'time', direction: 'desc' })))).toEqual(['High', 'Low', 'None']);
  });

  it('sorts by remaining achievements and by rarity', () => {
    const list = [
      game({ appid: 1, name: 'A', achievementsRemaining: 5, avgGlobalRarityRemaining: 30 }),
      game({ appid: 2, name: 'B', achievementsRemaining: 2, avgGlobalRarityRemaining: null }),
      game({ appid: 3, name: 'C', achievementsRemaining: 9, avgGlobalRarityRemaining: 10 }),
    ];
    expect(names(buildView(list, f({ sort: 'remaining' })))).toEqual(['B', 'A', 'C']);
    expect(names(buildView(list, f({ sort: 'rarity' })))).toEqual(['C', 'A', 'B']);
  });

  it('does not mutate the input array', () => {
    const list = [game({ appid: 1, name: 'B', difficultyScore: 2 }), game({ appid: 2, name: 'A', difficultyScore: 1 })];
    buildView(list, f());
    expect(names(list)).toEqual(['B', 'A']);
  });
});

describe('cmpNullsLast', () => {
  it('orders numbers by direction and nulls last', () => {
    expect(cmpNullsLast(1, 2, true)).toBeLessThan(0);
    expect(cmpNullsLast(1, 2, false)).toBeGreaterThan(0);
    expect(cmpNullsLast(null, 2, true)).toBe(1);
    expect(cmpNullsLast(null, 2, false)).toBe(1);
    expect(cmpNullsLast(2, null, false)).toBe(-1);
    expect(cmpNullsLast(null, null, true)).toBe(0);
  });
});
