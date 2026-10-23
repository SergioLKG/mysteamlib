import type { APIRoute } from 'astro';

export const prerender = true;

// Public, indexable pages only. Private ones are noindex and stay out.
const PATHS = ['/', '/privacidad', '/terminos'];

export const GET: APIRoute = ({ site }) => {
  const urls = PATHS.map((p) => `  <url><loc>${new URL(p, site).href}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
