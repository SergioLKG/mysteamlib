// Notebook ruling: how far a text block must move so its baseline sits on a rule
// (docs/features/estanteria-y-titulos.md, part A). Pure, so it is testable without a browser.

/**
 * Rules are drawn at y = k * gap - 1 (the last pixel of every gap, see `.ruled` in BaseLayout).
 * Returns the signed distance in px (within +-gap/2) from `baselineY` to the nearest rule.
 */
export function snapToRule(baselineY: number, gap: number): number {
  if (!(gap > 0)) return 0;
  const target = ((baselineY + 1) / gap) % 1;
  // `target` is how far past the previous rule we are, as a fraction of the gap.
  const fromPrev = target < 0 ? target + 1 : target;
  const delta = fromPrev <= 0.5 ? -fromPrev * gap : (1 - fromPrev) * gap;
  // `+ 0` turns -0 into 0.
  return Math.round(delta * 100) / 100 + 0;
}
