import type { APIRoute } from 'astro';
import { buildLoginUrl } from '../../../lib/auth/openid';

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

export const GET: APIRoute = ({ redirect }) => {
  const realm = baseUrl();
  const returnTo = `${realm}/api/auth/callback`;
  return redirect(buildLoginUrl({ realm, returnTo }));
};
