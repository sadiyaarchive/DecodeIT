// Build settings for the Figma plugin UI. Separate from vite.config.ts, which carries the Figma
// Make tooling and is only used for the browser dev server. Run through scripts/build-plugin.mjs.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolveWorkerUrl } from './src/lib/worker-url.ts';

export default defineConfig({
  root: process.cwd(),
  base: './',
  publicDir: false,
  plugins: [react()],
  // DECODEIT_WORKER_URL picks the Worker; validation failures stop the build.
  define: { __DECODEIT_WORKER_URL__: JSON.stringify(resolveWorkerUrl(process.env.DECODEIT_WORKER_URL).url) },
  build: {
    outDir: 'dist-plugin/.ui',
    emptyOutDir: true,
    target: 'es2019',
    cssCodeSplit: false,
    // The plugin iframe cannot load files next to it, so everything (the Geist font included) is inlined.
    assetsInlineLimit: 100_000_000,
    rollupOptions: { input: 'plugin/ui.html' },
  },
});
