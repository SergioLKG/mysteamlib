import type { APIRoute } from 'astro';
import { runDailySync } from '../../../lib/sync';

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

function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured → allow (dev/testing)
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}
