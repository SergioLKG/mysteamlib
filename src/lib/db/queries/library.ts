import { and, eq, ilike, isNotNull, sql, type SQL } from 'drizzle-orm';
import { db } from '../client';
import { achievements, games, hltbMatches, userAchievements, userGames } from '../schema';
import {
  ACHIEVEMENTS_REMAINING_MAX,
  DIFFICULTY_WEIGHTS,
  ESTIMATED_TIME_MAX_HOURS,
} from './difficulty';

export type ProgressState = 'all' | 'unplayed' | 'started' | 'completed';

export interface PlatinumFilters {
  /** Progress state. Defaults to `all`. */
  state?: ProgressState;
  /** Show already-100% games (hidden from candidates by default). */
  showCompleted?: boolean;
  /** `achievements_remaining` lower bound. */
  achievementsMin?: number;
  /** `achievements_remaining` upper bound. */
  achievementsMax?: number;
  /** `estimated_time_to_platinum` lower bound (hours). */
  timeMinHours?: number;
  /** `estimated_time_to_platinum` upper bound (hours). */
  timeMaxHours?: number;
  /** Keep games without an HLTB time visible (default true — never silently
   *  drop them; they sort last). When false, only games with a time show. */
  includeNoTime?: boolean;
  /** Exact genre match against `games.genres`. */
  genre?: string;
  /** Case-insensitive substring match on `games.name`. */
  search?: string;
}

export type PlatinumSortKey = 'difficulty' | 'remaining' | 'time' | 'rarity';
export type SortDirection = 'asc' | 'desc';

export interface PlatinumSort {
  key: PlatinumSortKey;
  /** Defaults to `asc` (difficulty asc = recommended first). */
  direction?: SortDirection;
}

export interface PlatinumCandidate {
  appid: number;
  name: string;
  headerImageUrl: string | null;
  genres: string[] | null;
  releaseDate: string | null;
  achievementsUnlocked: number;
  totalAchievements: number;
  achievementsRemaining: number;
  completionPercent: number;
  playtimeMinutes: number;
  estimatedTimeToPlatinum: number | null;
  hasTimeEstimate: boolean;
  avgGlobalRarityRemaining: number | null;
  difficultyScore: number;
}

/**
 * "Qué platinarse ahora" — the Fase 3 query. One SQL pass (CTE) that joins
 * `user_games` + `games` + `hltb_matches`, derives the Fase 3 fields and
 * computes `difficulty_score` with the tunable weights from `difficulty.ts`,
 * then applies filters and ordering entirely in SQL (never in JS memory).
 *
 * Base constraints (spec `03` §2/§8): the game must have achievements
 * (`has_achievements`) and a non-zero achievement count (protects against
 * Steam mislabels where total is 0); completed games are excluded UNLESS
 * `showCompleted` is set.
 */
export async function getPlatinumCandidates(
  userId: string,
  filters: PlatinumFilters = {},
  sort: PlatinumSort = { key: 'difficulty' },
): Promise<PlatinumCandidate[]> {
  if (!db) throw new Error('Database not configured');

  const derived = db.$with('pc_derived').as(
    db
      .select({
        appid: userGames.appid,
        name: games.name,
        headerImageUrl: games.headerImageUrl,
        genres: games.genres,
        releaseDate: games.releaseDate,
        achievementsUnlocked: userGames.achievementsUnlocked,
        totalAchievements: games.totalAchievements,
        achievementsRemaining: sql<number>`(${games.totalAchievements} - ${userGames.achievementsUnlocked})::int`.as('achievementsRemaining'),
        completionPercent: sql<number>`CASE WHEN ${games.totalAchievements} > 0 THEN round((100.0 * ${userGames.achievementsUnlocked}) / ${games.totalAchievements}, 1) ELSE 0.0 END`.as('completionPercent'),
        playtimeMinutes: userGames.playtimeMinutes,
        estimatedTimeToPlatinum: sql<number | null>`CASE WHEN ${hltbMatches.completionistHours} IS NOT NULL THEN GREATEST(${hltbMatches.completionistHours}::float8 - ${userGames.playtimeMinutes}::float8 / 60.0, 0.0)::float8 ELSE NULL END`.as('estimatedTimeToPlatinum'),
        hasTimeEstimate: sql<boolean>`(${hltbMatches.completionistHours} IS NOT NULL)`.as('hasTimeEstimate'),
        avgGlobalRarityRemaining: sql<number | null>`(
          SELECT avg(a.global_percent)::float8
          FROM achievements a
          LEFT JOIN user_achievements ua
            ON ua.achievement_id = a.id AND ua.user_id = ${userId}
          WHERE a.appid = ${userGames.appid}
            AND (ua.user_id IS NULL OR ua.unlocked = false)
            AND a.global_percent IS NOT NULL
        )`.as('avgGlobalRarityRemaining'),
      })
      .from(userGames)
      .innerJoin(games, eq(games.appid, userGames.appid))
      .leftJoin(hltbMatches, eq(hltbMatches.appid, userGames.appid))
      .where(
        and(
          eq(userGames.userId, userId),
          eq(games.hasAchievements, true),
          sql`${games.totalAchievements} > 0`,
        ),
      ),
  );

  const showCompleted = filters.showCompleted === true || filters.state === 'completed';

  const conds: (SQL | undefined)[] = [
    // Base: hide already-platinumed games unless the user asks to see them.
    showCompleted ? undefined : sql`(${derived.achievementsRemaining} > 0)`,
    filters.state === 'unplayed'
      ? eq(derived.playtimeMinutes, 0)
      : undefined,
    filters.state === 'started'
      ? and(
          sql`(${derived.achievementsUnlocked} > 0)`,
          sql`(${derived.achievementsRemaining} > 0)`,
        )
      : undefined,
    filters.state === 'completed'
      ? sql`(${derived.achievementsRemaining} = 0)`
      : undefined,
    filters.achievementsMin !== undefined
      ? sql`(${derived.achievementsRemaining} >= ${Math.max(filters.achievementsMin, 0)})`
      : undefined,
    filters.achievementsMax !== undefined
      ? sql`(${derived.achievementsRemaining} <= ${filters.achievementsMax})`
      : undefined,
    filters.timeMinHours !== undefined
      ? sql`(${derived.estimatedTimeToPlatinum} >= ${filters.timeMinHours})`
      : undefined,
    filters.timeMaxHours !== undefined
      ? sql`(${derived.estimatedTimeToPlatinum} <= ${filters.timeMaxHours})`
      : undefined,
    filters.includeNoTime === false
      ? isNotNull(derived.estimatedTimeToPlatinum)
      : undefined,
    filters.genre
      ? sql`(${filters.genre} = ANY(${derived.genres}))`
      : undefined,
    filters.search
      ? ilike(derived.name, `%${filters.search}%`)
      : undefined,
  ];
  const where = and(...conds);

  const direction = sort.direction ?? 'asc';

  // Weighted mean of normalized (0–100) terms; terms without data (no HLTB
  // time, no global rarity yet) drop out of both numerator and weight sum so
  // a missing datapoint neither helps nor hurts a game (spec `03` §3.2).
  const difficultyExpr = sql<number>`(
    ${DIFFICULTY_WEIGHTS.achievements}::float8 * LEAST(GREATEST(${derived.achievementsRemaining}, 0)::float8 / ${ACHIEVEMENTS_REMAINING_MAX}, 1.0) * 100.0
  + ${DIFFICULTY_WEIGHTS.rarity}::float8 * CASE WHEN ${derived.avgGlobalRarityRemaining} IS NOT NULL THEN LEAST(GREATEST(100.0 - ${derived.avgGlobalRarityRemaining}, 0.0), 100.0) ELSE 0.0 END
  + ${DIFFICULTY_WEIGHTS.time}::float8 * CASE WHEN ${derived.hasTimeEstimate} THEN LEAST(GREATEST(${derived.estimatedTimeToPlatinum}, 0.0)::float8 / ${ESTIMATED_TIME_MAX_HOURS}, 1.0) * 100.0 ELSE 0.0 END
  ) / (
    ${DIFFICULTY_WEIGHTS.achievements}::float8
  + ${DIFFICULTY_WEIGHTS.rarity}::float8 * CASE WHEN ${derived.avgGlobalRarityRemaining} IS NOT NULL THEN 1.0 ELSE 0.0 END
  + ${DIFFICULTY_WEIGHTS.time}::float8 * CASE WHEN ${derived.hasTimeEstimate} THEN 1.0 ELSE 0.0 END
  )`;

  let orderBy: SQL;
  switch (sort.key) {
    case 'remaining':
      orderBy = direction === 'asc'
        ? sql`${derived.achievementsRemaining} ASC NULLS LAST, ${derived.name} COLLATE "C" ASC`
        : sql`${derived.achievementsRemaining} DESC NULLS LAST, ${derived.name} COLLATE "C" ASC`;
      break;
    case 'time':
      // Null times always group last, in both directions (spec §5).
      orderBy = sql`${derived.estimatedTimeToPlatinum} ${direction === 'asc' ? sql`ASC` : sql`DESC`} NULLS LAST, ${derived.name} COLLATE "C" ASC`;
      break;
    case 'rarity':
      orderBy = direction === 'asc'
        ? sql`${derived.avgGlobalRarityRemaining} ASC NULLS LAST, ${derived.name} COLLATE "C" ASC`
        : sql`${derived.avgGlobalRarityRemaining} DESC NULLS LAST, ${derived.name} COLLATE "C" ASC`;
      break;
    case 'difficulty':
    default:
      orderBy = direction === 'asc'
        ? sql`${difficultyExpr} ASC NULLS LAST, ${derived.name} COLLATE "C" ASC`
        : sql`${difficultyExpr} DESC NULLS LAST, ${derived.name} COLLATE "C" ASC`;
      break;
  }

  const rows = await db
    .with(derived)
    .select({
      appid: derived.appid,
      name: derived.name,
      headerImageUrl: derived.headerImageUrl,
      genres: derived.genres,
      releaseDate: derived.releaseDate,
      achievementsUnlocked: derived.achievementsUnlocked,
      totalAchievements: derived.totalAchievements,
      achievementsRemaining: derived.achievementsRemaining,
      completionPercent: derived.completionPercent,
      playtimeMinutes: derived.playtimeMinutes,
      estimatedTimeToPlatinum: derived.estimatedTimeToPlatinum,
      hasTimeEstimate: derived.hasTimeEstimate,
      avgGlobalRarityRemaining: derived.avgGlobalRarityRemaining,
      difficultyScore: difficultyExpr,
    })
    .from(derived)
    .where(where)
    .orderBy(orderBy);

  return rows;
}

/** Distinct genres present in the user's achievement-having library, sorted. */
export async function getLibraryGenres(userId: string): Promise<string[]> {
  if (!db) throw new Error('Database not configured');

  const rows = await db
    .select({
      genre: sql<string>`unnest(${games.genres})`,
    })
    .from(userGames)
    .innerJoin(games, eq(games.appid, userGames.appid))
    .where(
      and(
        eq(userGames.userId, userId),
        eq(games.hasAchievements, true),
        sql`(${games.genres} IS NOT NULL)`,
      ),
    );

  return [...new Set(rows.map((r) => r.genre).filter(Boolean))].sort();
}