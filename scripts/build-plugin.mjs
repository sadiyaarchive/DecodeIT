// Builds the Figma plugin into dist-plugin/: manifest.json, code.js and a single self-contained ui.html.
//   node scripts/build-plugin.mjs        (or: pnpm run build:plugin)
// In Figma desktop: Plugins > Development > Import plugin from manifest..., then pick dist-plugin/manifest.json.
import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { networkAccessFor, resolveWorkerUrl } from '../src/lib/worker-url.ts';

// Validate before building anything: a bad DECODEIT_WORKER_URL should fail fast.
const worker = resolveWorkerUrl(process.env.DECODEIT_WORKER_URL);

const out = 'dist-plugin';
process.env.NODE_ENV = 'production';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// 1. The plugin code, as one plain script (Figma's sandbox cannot load modules).
await build({
  configFile: false,
  mode: 'production',
  publicDir: false,
  logLevel: 'warn',
  build: {
    lib: { entry: 'plugin/code.ts', formats: ['iife'], name: 'UnpackPlugin', fileName: () => 'code.js' },
    outDir: out,
    emptyOutDir: false,
    minify: false,
    target: 'es2017',
  },
});

// 2. The UI, then folded into one HTML file.
await build({ configFile: 'vite.plugin.config.ts', mode: 'production', logLevel: 'warn' });
const ui = path.join(out, '.ui');
const htmlPath = path.join(ui, 'plugin', 'ui.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const read = (ref) => fs.readFileSync(path.join(path.dirname(htmlPath), ref), 'utf8');
let inlined = 0;
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => {
  inlined++;
  return `<style>${read(href)}</style>`;
});
let script = '';
html = html.replace(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) => {
  inlined++;
  script += read(src).replace(/<\/script/gi, '<\\/script');
  return '';
});
html = html.replace('</body>', () => `<script type="module">${script}</script></body>`);
if (/\s(src|href)="\.{0,2}\/?assets\//.test(html) || inlined < 2) throw new Error('The UI still points at files next to it; the plugin iframe cannot load those.');
fs.writeFileSync(path.join(out, 'ui.html'), html);
fs.rmSync(ui, { recursive: true, force: true });

// 3. The manifest.
// networkAccess is derived from the Worker URL, so the manifest can never allow a different domain than
// the UI talks to. DECODEIT_PLUGIN_ID optionally replaces the placeholder plugin id (for your own fork).
const manifest = JSON.parse(fs.readFileSync('plugin/manifest.json', 'utf8'));
manifest.networkAccess = networkAccessFor(worker);
if (process.env.DECODEIT_PLUGIN_ID) manifest.id = process.env.DECODEIT_PLUGIN_ID.trim();
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Worker: ${worker.url}${worker.local ? ' (local development build)' : ''}`);

const kb = (f) => `${(fs.statSync(path.join(out, f)).size / 1024).toFixed(1)} KB`;
console.log(`dist-plugin/manifest.json  ${kb('manifest.json')}\ndist-plugin/code.js        ${kb('code.js')}\ndist-plugin/ui.html        ${kb('ui.html')}`);
