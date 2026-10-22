// Pure logic behind the shelf chart (DESIGN.md, Data display). No Svelte, DOM or DB imports.
// Height = hours; state = outline / hatch / solid, never colour alone.

export type SpineState = 'empty' | 'started' | 'played' | 'done';

export interface ShelfGame {
  id: number | string;
  name: string;
  hours: number;
  state: SpineState;
}

/** More spines than this stop being legible at 320 px; the legend still counts every game. */
export const SHELF_MAX_SPINES = 60;
/** Spine height range in % of the shelf. Unplayed games keep the floor so they stay visible. */
export const SPINE_MIN_HEIGHT = 18;
export const SPINE_MAX_HEIGHT = 100;
/** Below this a vertical label would be clipped; the bookmark ribbon and the caption still name the game. */
export const MARK_LABEL_MIN_HEIGHT = 55;

export const SPINE_STATE_LABEL: Record<SpineState, string> = {
  empty: 'Sin jugar',
  started: 'Empezado',
  played: 'Jugado',
  done: 'Completado',
};

export function countStates(games: readonly ShelfGame[]): Record<SpineState, number> {
  const counts: Record<SpineState, number> = { empty: 0, started: 0, played: 0, done: 0 };
  for (const g of games) counts[g.state] += 1;
  return counts;
}

/**
 * The games drawn on the shelf: the most played first (name as tiebreak, so the
 * order is stable). The bookmarked game is always kept, replacing the last
 * spine when it would fall outside the cut.
 */
export function sampleShelf(
  games: readonly ShelfGame[],
  opts: { max?: number; keepId?: ShelfGame['id'] } = {},
): ShelfGame[] {
  const max = opts.max ?? SHELF_MAX_SPINES;
  const sorted = [...games].sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name, 'es'));
  const shelf = sorted.slice(0, max);
  if (opts.keepId !== undefined && !shelf.some((g) => g.id === opts.keepId)) {
    const kept = sorted.find((g) => g.id === opts.keepId);
    if (kept && shelf.length > 0) shelf[shelf.length - 1] = kept;
  }
  return shelf;
}

/**
 * Spine heights in %. Square-root scale: a linear one flattens every game but
 * the two or three most played ones into the floor.
 */
export function spineHeights(games: readonly ShelfGame[]): number[] {
  const peak = Math.max(0, ...games.map((g) => g.hours));
  if (peak === 0) return games.map(() => SPINE_MIN_HEIGHT);
  const span = SPINE_MAX_HEIGHT - SPINE_MIN_HEIGHT;
  return games.map((g) => Math.round(SPINE_MIN_HEIGHT + span * Math.sqrt(Math.max(0, g.hours) / peak)));
}

/** «312 juegos: 18 sin jugar, 40 empezados…». Zero groups are omitted. */
export function shelfSummary(counts: Record<SpineState, number>): string {
  const total = counts.empty + counts.started + counts.played + counts.done;
  const parts: Array<[number, string, string]> = [
    [counts.empty, 'sin jugar', 'sin jugar'],
    [counts.started, 'empezado', 'empezados'],
    [counts.played, 'jugado', 'jugados'],
    [counts.done, 'completado', 'completados'],
  ];
  const list = parts.filter(([n]) => n > 0).map(([n, one, many]) => (n === 1 ? `1 ${one}` : `${n} ${many}`));
  const noun = total === 1 ? 'juego' : 'juegos';
  return list.length > 0 ? `${total} ${noun}: ${list.join(', ')}.` : `${total} ${noun}.`;
}
