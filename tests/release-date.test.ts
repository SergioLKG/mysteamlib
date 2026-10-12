import { describe, expect, it } from 'vitest';
import { parseReleaseDate } from '../src/lib/sync/releaseDate';

describe('parseReleaseDate', () => {
  it('keeps ISO dates untouched', () => {
    expect(parseReleaseDate('2026-09-09')).toBe('2026-09-09');
  });

  it('parses "D Mon, YYYY" and pads the day', () => {
    expect(parseReleaseDate('9 Sep, 2026')).toBe('2026-09-09');
    expect(parseReleaseDate('24 Dec, 2019')).toBe('2019-12-24');
  });

  it('accepts full month names and no comma', () => {
    expect(parseReleaseDate('5 March 2020')).toBe('2020-03-05');
  });

  it('parses year-only and month-year', () => {
    expect(parseReleaseDate('2026')).toBe('2026-01-01');
    expect(parseReleaseDate('Sep 2026')).toBe('2026-09-01');
    expect(parseReleaseDate('Sep, 2026')).toBe('2026-09-01');
  });

  it('returns null for junk and empty values', () => {
    expect(parseReleaseDate('Coming soon')).toBeNull();
    expect(parseReleaseDate('To be announced')).toBeNull();
    expect(parseReleaseDate('')).toBeNull();
    expect(parseReleaseDate(null)).toBeNull();
    expect(parseReleaseDate(undefined)).toBeNull();
    expect(parseReleaseDate('9 Foo, 2026')).toBeNull();
  });
});
