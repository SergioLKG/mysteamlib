import type { APIRoute } from 'astro';
import { runDailySync } from '../../../lib/sync';
import { isCronAuthorized } from '../../../lib/auth/cron';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isCronAuthorized(request)) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const result = await runDailySync();
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('sync-library cron failed', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
