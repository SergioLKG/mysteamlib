// @ts-check
import { defineConfig } from 'astro/config';

import vercel from '@astrojs/vercel';

import svelte from '@astrojs/svelte';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [svelte()],
  vite: {
    optimizeDeps: {
      include: ['svelte', 'drizzle-orm'], // Añade aquí dependencias comunes que uses
    }
  }
});