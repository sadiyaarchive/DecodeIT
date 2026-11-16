import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolveWorkerUrl } from './src/lib/worker-url.ts'

// Dev server and UI build. The Figma plugin bundle is built by scripts/build-plugin.mjs with
// vite.plugin.config.ts.
export default defineConfig({
  // DECODEIT_WORKER_URL picks the Worker the UI talks to (default: the hosted one). It is a public
  // URL; validation failures stop the build. See docs/SELF_HOSTING.md.
  define: { __DECODEIT_WORKER_URL__: JSON.stringify(resolveWorkerUrl(process.env.DECODEIT_WORKER_URL).url) },
  plugins: [react(), tailwindcss()],
  server: { port: parseInt(process.env.PORT || '8443'), strictPort: true },
  preview: { port: parseInt(process.env.PORT || '8443') },
})
