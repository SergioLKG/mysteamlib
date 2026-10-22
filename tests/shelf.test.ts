import { describe, expect, it } from 'vitest';
import {
  SPINE_MAX_HEIGHT,
  SPINE_MIN_HEIGHT,
  countStates,
  sampleShelf,
  shelfSummary,
  spineHeights,
  type ShelfGame,
  type SpineState,
} from '../src/lib/ui/shelf';

function game(id: number, hours: number, state: SpineState = 'played', name = `g${id}`): ShelfGame {
  return { id, name, hours, state };
}

describe('countStates', () => {
  it('counts every state, including empty ones', () => {
    const counts = countStates([game(1, 0, 'empty'), game(2, 5), game(3, 9), game(4, 20, 'done')]);
    expect(counts).toEqual({ empty: 1, started: 0, played: 2, done: 1 });
  });
});

describe('sampleShelf', () => {
  const games = [game(1, 5), game(2, 50), game(3, 0, 'empty'), game(4, 20)];

  it('orders by hours desc and cuts at max', () => {
    expect(sampleShelf(games, { max: 3 }).map((g) => g.id)).toEqual([2, 4, 1]);
  });

  it('breaks ties by name so the order is stable', () => {
    const tied = [game(1, 3, 'played', 'b'), game(2, 3, 'played', 'a')];
    expect(sampleShelf(tied).map((g) => g.id)).toEqual([2, 1]);
  });

  it('keeps the bookmarked game when it falls outside the cut', () => {
    expect(sampleShelf(games, { max: 2, keepId: 3 }).map((g) => g.id)).toEqual([2, 3]);
  });

  it('does not duplicate the bookmarked game when it is already in', () => {
    expect(sampleShelf(games, { max: 2, keepId: 2 }).map((g) => g.id)).toEqual([2, 4]);
  });

  it('ignores an unknown keepId', () => {
    expect(sampleShelf(games, { max: 2, keepId: 99 }).map((g) => g.id)).toEqual([2, 4]);
  });
});

describe('spineHeights', () => {
  it('maps the peak to the maximum and zero hours to the floor', () => {
    expect(spineHeights([game(1, 100), game(2, 0, 'empty')])).toEqual([SPINE_MAX_HEIGHT, SPINE_MIN_HEIGHT]);
  });

  it('uses a square-root scale: a quarter of the peak sits at the midpoint', () => {
    const [, quarter] = spineHeights([game(1, 100), game(2, 25)]);
    expect(quarter).toBe(Math.round((SPINE_MIN_HEIGHT + SPINE_MAX_HEIGHT) / 2));
  });

  it('gives every game the floor when nobody has hours', () => {
    expect(spineHeights([game(1, 0, 'empty'), game(2, 0, 'empty')])).toEqual([SPINE_MIN_HEIGHT, SPINE_MIN_HEIGHT]);
  });

  it('returns nothing for an empty shelf', () => {
    expect(spineHeights([])).toEqual([]);
  });
});

describe('shelfSummary', () => {
  it('lists non-empty groups with the right number', () => {
    expect(shelfSummary({ empty: 18, started: 1, played: 0, done: 293 })).toBe(
      '312 juegos: 18 sin jugar, 1 empezado, 293 completados.',
    );
  });

  it('uses the singular for a single game', () => {
    expect(shelfSummary({ empty: 0, started: 0, played: 1, done: 0 })).toBe('1 juego: 1 jugado.');
  });

  it('says only the total when there are no games', () => {
    expect(shelfSummary({ empty: 0, started: 0, played: 0, done: 0 })).toBe('0 juegos.');
  });
});
