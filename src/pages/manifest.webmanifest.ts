import type { APIRoute } from 'astro';
import { THEME_COLOR } from '../lib/ui/theme-colors';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      name: 'mysteamlib',
      short_name: 'mysteamlib',
      description: 'Tu biblioteca de Steam y tu próximo platino.',
      lang: 'es',
      start_url: '/',
      display: 'browser',
      theme_color: THEME_COLOR.dark,
      background_color: THEME_COLOR.dark,
      icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
    }),
    { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' } },
  );
