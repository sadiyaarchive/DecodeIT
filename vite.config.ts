import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev server and UI build. The Figma plugin bundle is built by scripts/build-plugin.mjs with
// vite.plugin.config.ts.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: parseInt(process.env.PORT || '8443'), strictPort: true },
  preview: { port: parseInt(process.env.PORT || '8443') },
})
