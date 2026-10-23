import { describe, expect, it } from 'vitest';
import { snapToRule } from '../src/lib/ui/ruledBaseline';

describe('snapToRule', () => {
  it('is zero when the baseline already sits on a rule (k * gap - 1)', () => {
    expect(snapToRule(27, 28)).toBe(0);
    expect(snapToRule(55, 28)).toBe(0);
  });

  it('moves up when the baseline is just below a rule', () => {
    expect(snapToRule(30, 28)).toBe(-3);
  });

  it('moves down when the baseline is just above the next rule', () => {
    expect(snapToRule(50, 28)).toBe(5);
  });

  it('never moves more than half a gap', () => {
    for (let y = 0; y < 120; y += 0.5) {
      expect(Math.abs(snapToRule(y, 28))).toBeLessThanOrEqual(14);
    }
  });

  it('lands on a rule after applying the offset', () => {
    for (const y of [3, 17.3, 41, 99.9]) {
      const landed = y + snapToRule(y, 28) + 1;
      expect(Math.abs(landed / 28 - Math.round(landed / 28))).toBeLessThan(0.01);
    }
  });

  it('ignores an invalid gap', () => {
    expect(snapToRule(10, 0)).toBe(0);
    expect(snapToRule(10, Number.NaN)).toBe(0);
  });
});
