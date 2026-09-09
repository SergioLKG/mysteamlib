import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/auth/session';

const protectedPaths = ['/dashboard', '/platino'];
const protectedApiPrefixes = ['/api/games'];

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const path = url.pathname;

  const isProtected =
    protectedPaths.some((p) => path === p || path.startsWith(`${p}/`)) ||
    protectedApiPrefixes.some((p) => path.startsWith(p));

  if (!isProtected) {
    return next();
  }

  const session = getSession(context);

  if (!session) {
    if (path.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const login = new URL('/api/auth/login', url);
    login.searchParams.set('next', path);
    return context.redirect(login.toString());
  }

  context.locals.user = session;
  return next();
});
