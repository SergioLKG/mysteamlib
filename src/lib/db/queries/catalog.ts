import { sql } from 'drizzle-orm';
import { requireDb } from '../client';

export interface CatalogInfo {
  genres: string[] | null;
  headerImageUrl: string | null;
}

export interface CatalogLookup {
  info: Map<number, CatalogInfo>;
  /** True when the query failed: `info` is empty and must not be cached. */
  degraded: boolean;
}

/**
 * Catalog data (`games`) for a list of appids. One query with a single text
 * parameter (`string_to_array`) instead of `inArray`, which would bind one
 * parameter per appid (thousands for a big library). Appids missing from the
 * catalog are simply absent from the Map. Best effort: on failure it logs and
 * returns an empty Map flagged `degraded`, so the caller shows «Sin dato»
 * instead of failing, and can avoid caching the degraded answer.
 */
export async function getCatalogInfo(appids: readonly number[]): Promise<CatalogLookup> {
  const out = new Map<number, CatalogInfo>();
  if (appids.length === 0) return { info: out, degraded: false };
  try {
    const res = await requireDb().execute<{
      appid: number;
      genres: string[] | null;
      header_image_url: string | null;
    }>(sql`
      SELECT appid, genres, header_image_url
      FROM games
      WHERE appid = ANY(string_to_array(${appids.join(',')}, ',')::int[])
    `);
    for (const r of res.rows) {
      out.set(Number(r.appid), { genres: r.genres, headerImageUrl: r.header_image_url });
    }
  } catch (e) {
    console.error('[catalog] getCatalogInfo failed', e);
    return { info: new Map(), degraded: true };
  }
  return { info: out, degraded: false };
}
