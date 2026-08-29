import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
  const hasDbUrl = Boolean(process.env.DATABASE_URL);

  return new Response(
    JSON.stringify({
      status: hasDbUrl ? 'ok' : 'degraded',
      db: hasDbUrl ? 'configured' : 'not_configured',
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};