import { describe, expect, it } from 'vitest';
import { levelBadge } from '../src/lib/ui/steamLevel';

describe('levelBadge', () => {
  it('colours the ring by decade', () => {
    expect(levelBadge(0).ink).toBe('var(--color-level-0)');
    expect(levelBadge(9).ink).toBe('var(--color-level-0)');
    expect(levelBadge(10).ink).toBe('var(--color-level-10)');
    expect(levelBadge(57).ink).toBe('var(--color-level-50)');
    expect(levelBadge(99).ink).toBe('var(--color-level-90)');
  });

  it('repeats the colour cycle every 100 levels', () => {
    expect(levelBadge(100).ink).toBe('var(--color-level-0)');
    expect(levelBadge(142).ink).toBe('var(--color-level-40)');
    expect(levelBadge(1234).ink).toBe('var(--color-level-30)');
  });

  it('draws a hexagon only from 100 to 199', () => {
    expect(levelBadge(99).shape).toBe('circle');
    expect(levelBadge(100).shape).toBe('hexagon');
    expect(levelBadge(199).shape).toBe('hexagon');
    expect(levelBadge(200).shape).toBe('circle');
  });

  it('clamps bad input to level 0', () => {
    expect(levelBadge(-3)).toEqual({ level: 0, ink: 'var(--color-level-0)', shape: 'circle' });
    expect(levelBadge(Number.NaN).level).toBe(0);
    expect(levelBadge(12.7).level).toBe(12);
  });
});
