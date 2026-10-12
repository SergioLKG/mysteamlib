import { createHmac } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from './client';

export interface RateLimitRule {
  /** Namespace of the limiter, e.g. `lookup`. */
  bucket: string;
  /** Max requests per window. */
  max: number;
  windowSeconds: number;
}

// Rows older than this are dead weight. Purged opportunistically on lookups and
// on every cron call, so no row outlives the daily Vercel cron (see privacidad.astro).
const PURGE_AFTER_HOURS = 1;
const PURGE_PROBABILITY = 0.02;

/** HMAC of the IP: the table never stores a raw IP (see privacidad.astro). */
function hashIp(ip: string): string {
  const secret = process.env.SESSION_SECRET ?? 'dev-only';
  return createHmac('sha256', secret).update(`rate-limit:${ip}`).digest('hex').slice(0, 32);
}

/**
 * Fixed-window limiter persisted in Neon (survives cold starts, shared by all
 * instances). One atomic upsert per call. Returns true when the caller is over
 * the limit. Fails OPEN (returns false) if the DB is unavailable: the endpoint
 * is still protected by the Steam daily budget.
 */
export async function isRateLimited(rule: RateLimitRule, ip: string): Promise<boolean> {
  if (!db) return false;
  const key = `${rule.bucket}:${hashIp(ip)}`;
  try {
    const res = await db.execute<{ count: number }>(sql`
      INSERT INTO rate_limits (key, window_start, count)
      VALUES (${key}, now(), 1)
      ON CONFLICT (key) DO UPDATE SET
        window_start = CASE WHEN rate_limits.window_start <= now() - make_interval(secs => ${rule.windowSeconds})
                            THEN now() ELSE rate_limits.window_start END,
        count = CASE WHEN rate_limits.window_start <= now() - make_interval(secs => ${rule.windowSeconds})
                     THEN 1 ELSE rate_limits.count + 1 END
      RETURNING count
    `);
    if (Math.random() < PURGE_PROBABILITY) await purgeRateLimits();
    return Number(res.rows[0]?.count ?? 0) > rule.max;
  } catch (e) {
    console.error('[rateLimit] check failed, allowing request', e);
    return false;
  }
}

/** Delete expired windows. Best effort: a failure is logged, never thrown. */
export async function purgeRateLimits(): Promise<void> {
  if (!db) return;
  try {
    await db.execute(
      sql`DELETE FROM rate_limits WHERE window_start < now() - make_interval(hours => ${PURGE_AFTER_HOURS})`,
    );
  } catch (e) {
    console.error('[rateLimit] purge failed', e);
  }
}
