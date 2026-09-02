import type { APIRoute } from 'astro';
import { db } from '../../lib/db/client';
import { healthCheck } from '../../lib/db/schema';

export const prerender = false;

export const GET: APIRoute = async () => {
  let dbStatus: 'connected' | 'error' | 'not_configured' = 'not_configured';

  if (db) {
    try {
      await db.select({ id: healthCheck.id }).from(healthCheck).limit(1);
      dbStatus = 'connected';
    } catch (e) {
      dbStatus = 'error';
      console.error('Health check DB error:', e);
    }
  }

  const ok = dbStatus === 'connected';

  return new Response(
    JSON.stringify({
      status: ok ? 'ok' : 'degraded',
      db: dbStatus,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};