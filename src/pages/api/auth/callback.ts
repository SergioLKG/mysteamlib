import type { APIRoute } from 'astro';
import { verifyOpenIdResponse } from '../../../lib/auth/openid';
import { getPlayerSummaries } from '../../../lib/steam/webApi';
import { db } from '../../../lib/db/client';
import { users } from '../../../lib/db/schema';
import { eq } from 'drizzle-orm';
import { setSession } from '../../../lib/auth/session';

export const prerender = false;

function baseUrl(): string {
  const realm = process.env.STEAM_OPENID_REALM;
  if (realm) return realm.replace(/\/$/, '');
  return import.meta.env.SITE?.replace(/\/$/, '') ?? 'http://localhost:4321';
}

export const GET: APIRoute = async (context) => {
  const { request, redirect } = context;
  const realm = baseUrl();
  const returnTo = `${realm}/api/auth/callback`;
  const params = new URL(request.url).searchParams;

  const steamId = await verifyOpenIdResponse(returnTo, params);
  if (!steamId) {
    return new Response('<html><body>Steam authentication failed. <a href="/">Go back</a>.</body></html>', {
      status: 401,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  let profile = null;
  if (process.env.STEAM_API_KEY) {
    try {
      const res = await getPlayerSummaries([steamId]);
      profile = res.response?.players?.[0] ?? null;
    } catch (e) {
      console.error('getPlayerSummaries failed', e);
      profile = null;
    }
  }

  if (!db) {
    return new Response('Database not configured', { status: 500 });
  }

  let [user] = await db.select().from(users).where(eq(users.steamId, steamId));

  if (!user) {
    const inserted = await db
      .insert(users)
      .values({
        steamId,
        personaName: profile?.personaname ?? steamId,
        avatarUrl: profile?.avatarfull ?? null,
      })
      .returning();
    user = inserted[0];
  } else if (profile && profile.personaname !== user.personaName) {
    const updated = await db
      .update(users)
      .set({ personaName: profile.personaname, avatarUrl: profile.avatarfull ?? user.avatarUrl })
      .where(eq(users.id, user.id))
      .returning();
    user = updated[0];
  }

  setSession(context, { userId: user.id.toString(), steamId });

  const next = new URL(request.url).searchParams.get('next') ?? '/dashboard';
  return redirect(next);
};
