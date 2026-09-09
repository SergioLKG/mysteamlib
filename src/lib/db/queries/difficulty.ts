// Product tuning (owner decision 09 sep 2026): difficulty_score weights.
//
// difficulty_score is a weighted mean of normalized (0–100) terms:
//   - achievements remaining        (weight `achievements`)
//   - rarity of the achievements you're still missing (100 - avg global %)
//   - estimated hours to platinum   (weight `time`)
//
// Lower score = more recommended to platinum now. Terms without data (e.g. no
// HLTB match, or no global rarity yet) are excluded from both the numerator
// and the weight sum, so a missing datapoint neither helps nor hurts a game.
// These are product decisions, kept as clear constants — adjust freely.
export const DIFFICULTY_WEIGHTS = {
  achievements: 1.0,
  rarity: 0.7,
  time: 0.5,
} as const;

// Normalization ceilings: the number of remaining achievements / hours that
// maps to 100 in each term.
export const ACHIEVEMENTS_REMAINING_MAX = 30;
export const ESTIMATED_TIME_MAX_HOURS = 100;

/** Normalize a non-negative value to a 0–100 scale with an upper cap. */
export function normalize(value: number, max: number): number {
  if (Number.isNaN(value) || value <= 0) return 0;
  return (Math.min(value, max) / max) * 100;
}