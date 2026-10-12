import type { APIRoute } from 'astro';
import { buildLoginUrl } from '../../../lib/auth/openid';
import { safeNext } from '../../../lib/auth/redirect';

export const prerender = false;

function baseUrl(): string {
  const realm = process.env.STEAM_OPENID_REALM;
  if (realm) return realm.replace(/\/$/, '');
  const url = import.meta.env.SITE;
  if (url) return url.replace(/\/$/, '');
  return process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:4321';
}

export const GET: APIRoute = ({ request, redirect }) => {
  const realm = baseUrl();
  const next = safeNext(new URL(request.url).searchParams.get('next'));
  const callback = `${realm}/api/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`;
  return redirect(buildLoginUrl({ realm, returnTo: callback }));
};
