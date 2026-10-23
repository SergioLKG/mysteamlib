// Pure logic behind the Steam level badge in the library card (docs/features/estanteria-y-titulos.md).
// No Svelte, DOM or DB imports: islands import it.

export type LevelShape = 'circle' | 'hexagon';

export interface LevelBadge {
  level: number;
  /** Ring colour, a CSS value (one token per decade, as on Steam). */
  ink: string;
  shape: LevelShape;
}

/** Ring colour by decade (0-9 grey, 10 red … 90 gold); the cycle repeats every 100 levels. */
const DECADE_INK = [
  'var(--color-level-0)',
  'var(--color-level-10)',
  'var(--color-level-20)',
  'var(--color-level-30)',
  'var(--color-level-40)',
  'var(--color-level-50)',
  'var(--color-level-60)',
  'var(--color-level-70)',
  'var(--color-level-80)',
  'var(--color-level-90)',
] as const;

/** Levels drawn as a hexagon; every other level is a circle (shapes from 1500 on are not modelled). */
export const HEXAGON_LEVELS = { from: 100, to: 199 } as const;

export function levelBadge(level: number): LevelBadge {
  const n = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
  return {
    level: n,
    ink: DECADE_INK[Math.floor((n % 100) / 10)],
    shape: n >= HEXAGON_LEVELS.from && n <= HEXAGON_LEVELS.to ? 'hexagon' : 'circle',
  };
}
