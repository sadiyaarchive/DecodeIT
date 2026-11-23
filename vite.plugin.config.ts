// Build settings for the self-contained Figma plugin UI.
// Run through scripts/build-plugin.mjs; vite.config.ts serves the browser preview.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: process.cwd(),
  base: './',
  publicDir: false,
  plugins: [react()],
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
