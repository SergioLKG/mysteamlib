import type { APIRoute } from 'astro';

export const prerender = true;

// Private pages are not disallowed on purpose: the crawler must be able to read their `noindex`.
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nDisallow: /api/\n\nSitemap: ${new URL('/sitemap.xml', site).href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
