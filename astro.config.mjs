// @ts-check
import { defineConfig } from 'astro/config';

import vercel from '@astrojs/vercel';

import svelte from '@astrojs/svelte';

// https://astro.build/config
export default defineConfig({
  // Canonical URLs and the sitemap derive from it; changes with the domain (Phase 13).
  site: 'https://mysteamlib.vercel.app',
  output: 'server',
  adapter: vercel(),
  integrations: [svelte()],
  vite: {
    optimizeDeps: {
      include: ['svelte', 'drizzle-orm'], // Añade aquí dependencias comunes que uses
    }
  }
});