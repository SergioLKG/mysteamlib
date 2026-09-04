import type { APIRoute } from 'astro';
import { refreshGame } from '../../../../lib/sync';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const appid = Number(context.params.appid);
  if (!Number.isInteger(appid) || appid <= 0) {
    return new Response(JSON.stringify({ error: 'Invalid appid' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await refreshGame(user.userId, appid);
    return new Response(JSON.stringify({ ok: true, appid, ...result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(`refresh failed for appid=${appid}`, e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
