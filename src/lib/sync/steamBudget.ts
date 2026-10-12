import { sql } from 'drizzle-orm';
import { db } from '../db/client';
import { SteamRateLimitError, setSteamCallGuard } from '../steam/webApi';

// Valve allows 100,000 Steam Web API calls per day per key, shared by the
// syncs, the login and the anonymous lookup (decision A11 / debt D10).
export const STEAM_DAILY_LIMIT = 100_000;
// One warning in the logs when the day crosses 70 %.
export const STEAM_WARN_AT = Math.floor(STEAM_DAILY_LIMIT * 0.7);
// Refuse further calls at 95 % so a bug or a traffic spike never burns the key.
export const STEAM_HARD_STOP_AT = Math.floor(STEAM_DAILY_LIMIT * 0.95);

/**
 * Count one outgoing Steam call (one atomic upsert on the UTC day) and refuse
 * it past the hard stop. A DB failure never blocks Steam: it is logged and the
 * call goes through. Counting happens per call, not per run, because a
 * serverless run can be killed mid-way.
 */
export async function countSteamCall(): Promise<void> {
  if (!db) return;
  let calls: number;
  try {
    const res = await db.execute<{ calls: number }>(sql`
      INSERT INTO steam_api_calls (day, calls)
      VALUES ((now() AT TIME ZONE 'UTC')::date, 1)
      ON CONFLICT (day) DO UPDATE SET calls = steam_api_calls.calls + 1
      RETURNING calls
    `);
    calls = Number(res.rows[0]?.calls ?? 0);
  } catch (e) {
    console.error('[steamBudget] could not count Steam call', e);
    return;
  }
  if (calls === STEAM_WARN_AT) {
    console.warn(`[steamBudget] ${calls} Steam calls today (70 % of ${STEAM_DAILY_LIMIT}).`);
  }
  if (calls > STEAM_HARD_STOP_AT) {
    throw new SteamRateLimitError(`Steam daily call budget exhausted (${calls}/${STEAM_DAILY_LIMIT})`);
  }
}

// Registered on import. Every module that calls `lib/steam/webApi` imports this
// file for its side effect so no call goes uncounted.
setSteamCallGuard(countSteamCall);
