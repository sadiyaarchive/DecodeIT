// Builds the Figma plugin into dist-plugin/: manifest.json, code.js and a single self-contained ui.html.
//   node scripts/build-plugin.mjs        (or: pnpm run build:plugin)
// In Figma desktop: Plugins > Development > Import plugin from manifest..., then pick dist-plugin/manifest.json.
import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

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
fs.copyFileSync('plugin/manifest.json', path.join(out, 'manifest.json'));

const kb = (f) => `${(fs.statSync(path.join(out, f)).size / 1024).toFixed(1)} KB`;
console.log(`dist-plugin/manifest.json  ${kb('manifest.json')}\ndist-plugin/code.js        ${kb('code.js')}\ndist-plugin/ui.html        ${kb('ui.html')}`);
