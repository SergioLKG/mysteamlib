import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS_REMAINING_MAX,
  DIFFICULTY_WEIGHTS,
  ESTIMATED_TIME_MAX_HOURS,
  normalize,
} from '../src/lib/db/queries/difficulty';

describe('normalize', () => {
  it('maps a value to a 0-100 scale', () => {
    expect(normalize(15, 30)).toBe(50);
    expect(normalize(30, 30)).toBe(100);
  });

  it('caps values above the ceiling at 100', () => {
    expect(normalize(500, ACHIEVEMENTS_REMAINING_MAX)).toBe(100);
    expect(normalize(1000, ESTIMATED_TIME_MAX_HOURS)).toBe(100);
  });

  it('returns 0 for zero, negative and NaN values', () => {
    expect(normalize(0, 30)).toBe(0);
    expect(normalize(-5, 30)).toBe(0);
    expect(normalize(Number.NaN, 30)).toBe(0);
  });
});

describe('DIFFICULTY_WEIGHTS', () => {
  it('keeps every weight positive', () => {
    for (const w of Object.values(DIFFICULTY_WEIGHTS)) expect(w).toBeGreaterThan(0);
  });
});
