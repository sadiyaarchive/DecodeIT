// Checks the plugin's message protocol, selection rules and screenshot validation. These are the
// parts that can be tested without Figma itself. No dependencies:
//   node scripts/check-plugin.mts
import { isPluginToUi, isUiToPlugin, toUint8Array } from '../src/lib/figma/protocol.ts';
import { classifySelection, isSupportedType, previewScale, typeLabel } from '../src/lib/figma/selection.ts';
import { DEFAULT_WORKER_URL } from '../src/lib/worker-provider.ts';
import { networkAccessFor, resolveWorkerUrl } from '../src/lib/worker-url.ts';
import { checkImageMeta, describeDesign, MAX_IMAGE_BYTES } from '../src/lib/design.ts';
import manifest from '../plugin/manifest.json' with { type: 'json' };

const failures: string[] = [];
const check = (name: string, ok: boolean) => ok || failures.push(name);
const node = (type: string, w = 390, h = 844) => ({ id: '1:2', name: 'Home', type, width: w, height: h });

// --- messages from the plugin: only exact, well-formed ones are accepted ---
const png = new Uint8Array([137, 80, 78, 71]);
check('host-ready is accepted', isPluginToUi({ type: 'host-ready', host: 'figma', protocol: 1 }));
check('simulated host-ready and host-off are accepted', isPluginToUi({ type: 'host-ready', host: 'figma', protocol: 1, simulated: true }) && isPluginToUi({ type: 'host-off' }));
check('every selection state is accepted', [
  { kind: 'none' },
  { kind: 'multiple', count: 3 },
  { kind: 'unsupported', nodeType: 'TEXT', name: 'Heading' },
  { kind: 'loading', id: '1:2', name: 'Home', nodeType: 'FRAME', width: 1, height: 1 },
  { kind: 'frame', id: '1:2', name: 'Home', nodeType: 'FRAME', width: 390, height: 844, image: png, imageWidth: 780, imageHeight: 1688 },
  { kind: 'frame', id: '1:2', name: 'Home', nodeType: 'FRAME', width: 390, height: 844, image: png.buffer, imageWidth: 780, imageHeight: 1688 },
  { kind: 'frame', id: '1:2', name: 'Home', nodeType: 'FRAME', width: 390, height: 844, image: [137, 80, 78, 71], imageWidth: 780, imageHeight: 1688 },
  { kind: 'error', message: 'gone' },
].every((state) => isPluginToUi({ type: 'selection', seq: 1, state })));
check('toUint8Array normalises Uint8Array, ArrayBuffer and number[]', [png, png.buffer, [137, 80, 78, 71]].every((raw) => toUint8Array(raw).byteLength === 4 && toUint8Array(raw)[0] === 137));
for (const [name, bad] of [
  ['null', null],
  ['a string', 'host-ready'],
  ['an unknown type', { type: 'hello' }],
  ['host-ready from another host', { type: 'host-ready', host: 'web', protocol: 1 }],
  ['a selection without a state', { type: 'selection', seq: 1 }],
  ['an unknown state', { type: 'selection', seq: 1, state: { kind: 'dragging' } }],
  ['a frame without an image', { type: 'selection', seq: 1, state: { kind: 'frame', id: 'x', name: 'x', nodeType: 'FRAME', width: 1, height: 1, imageWidth: 1, imageHeight: 1 } }],
  ['a frame whose image is a string', { type: 'selection', seq: 1, state: { kind: 'frame', id: 'x', name: 'x', nodeType: 'FRAME', width: 1, height: 1, image: 'png', imageWidth: 1, imageHeight: 1 } }],
  ['a non-numeric sequence', { type: 'selection', seq: '1', state: { kind: 'none' } }],
] as const) check(`rejects ${name}`, !isPluginToUi(bad));
check('UI messages: ui-ready, refresh and notify are accepted', [{ type: 'ui-ready' }, { type: 'refresh-selection' }, { type: 'notify', text: 'Copied' }].every(isUiToPlugin));
check('UI messages: junk is rejected', !isUiToPlugin({ type: 'notify' }) && !isUiToPlugin({ type: 'close-everything' }) && !isUiToPlugin(undefined));

// --- selection rules ---
check('nothing selected', classifySelection([]).kind === 'none');
check('several selected', (classifySelection([node('FRAME'), node('FRAME')]) as { count: number }).count === 2);
for (const t of ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'SECTION', 'GROUP']) check(`${t} is a usable design`, classifySelection([node(t)]).kind === 'candidate');
for (const t of ['TEXT', 'RECTANGLE', 'ELLIPSE', 'VECTOR', 'LINE', 'SLICE']) check(`${t} is not a design`, classifySelection([node(t)]).kind === 'unsupported' && !isSupportedType(t));
check('an empty frame is not a design', classifySelection([node('FRAME', 0, 0)]).kind === 'unsupported');
check('layer types have readable names', typeLabel('TEXT') === 'a text layer' && typeLabel('SOMETHING_NEW') === 'that layer');

// --- preview size: sharp but bounded, inside what Figma accepts (0.01 to 4) ---
check('a normal frame exports at 2x', previewScale(300, 600) === 2);
check('a wide frame is scaled down to the width cap', previewScale(1440, 900) === 0.5);
check('a very tall frame is scaled to the height cap', previewScale(390, 12000) === 0.2);
check('a huge frame stays above Figma\'s minimum', previewScale(100000, 100000) >= 0.01);
check('a tiny frame never exceeds the maximum scale', previewScale(2, 2) <= 4);
check('export size is bounded for typical large frames', [[1440, 900], [1920, 5000], [390, 12000]].every(([w, h]) => w * previewScale(w, h) <= 720 && h * previewScale(w, h) <= 2400));

// --- screenshot checks that need only the file's type and size ---
const ok = (type: string, size = 1000, name = 'a.png') => checkImageMeta({ name, type, size }).ok;
check('PNG, JPG and WebP are accepted', ok('image/png') && ok('image/jpeg') && ok('image/webp'));
check('GIF, SVG, PDF and text are rejected', !ok('image/gif') && !ok('image/svg+xml') && !ok('application/pdf') && !ok('text/plain'));
check('HEIC gets its own explanation', /HEIC/.test((checkImageMeta({ name: 'a.heic', type: '', size: 10 }) as { reason: string }).reason));
check('an empty file is rejected', !ok('image/png', 0));
check('the screenshot limit matches the Worker (4 MB)', MAX_IMAGE_BYTES === 4_000_000);
check('the size limit is enforced', ok('image/png', MAX_IMAGE_BYTES) && !ok('image/png', MAX_IMAGE_BYTES + 1));
check('failure reasons are sentences a person can act on', ['image/gif', 'text/plain'].every((t) => /^[A-Z].*\.$/.test((checkImageMeta({ name: 'x', type: t, size: 1 }) as { reason: string }).reason)));
check('design description', describeDesign({ kind: 'figma-frame', name: 'Home', width: 390.4, height: 844 }) === 'Figma frame "Home", 390 × 844');

// --- manifest ---
check('manifest: UI and code files named as the build produces them', manifest.main === 'code.js' && manifest.ui === 'ui.html');
const na = manifest.networkAccess;
const def = resolveWorkerUrl();
check('worker url: the default is the hosted https Worker', def.url === DEFAULT_WORKER_URL && DEFAULT_WORKER_URL.startsWith('https://') && !def.local);
check('manifest: network access is exactly the default Worker, nothing else', JSON.stringify(na.allowedDomains) === JSON.stringify([DEFAULT_WORKER_URL]) && na.devAllowedDomains === undefined);
check('manifest: the committed networkAccess is what the build derives (run build:plugin to see it)', JSON.stringify(na) === JSON.stringify(networkAccessFor(def)));
check('manifest: reasoning discloses the image, feedback, Worker and Gemini', ['image', 'feedback', 'Worker', 'Gemini', 'agrees'].every((w) => na.reasoning.includes(w)));
check('manifest: reasoning no longer claims there is no network use', !/no network/i.test(na.reasoning));

// --- DECODEIT_WORKER_URL ---
const throws = (v: string) => { try { resolveWorkerUrl(v); return false; } catch { return true; } };
const custom = resolveWorkerUrl(' https://my-decodeit.me.workers.dev/ ');
check('worker url: custom https URL is reduced to its origin', custom.url === 'https://my-decodeit.me.workers.dev' && !custom.local);
check('worker url: custom URL drives allowedDomains and the reasoning host', JSON.stringify(networkAccessFor(custom).allowedDomains) === '["https://my-decodeit.me.workers.dev"]' && networkAccessFor(custom).reasoning.includes('my-decodeit.me.workers.dev'));
check('worker url: empty falls back to the default', resolveWorkerUrl('').url === DEFAULT_WORKER_URL && resolveWorkerUrl(undefined).url === DEFAULT_WORKER_URL);
check('worker url: http is refused for remote hosts', throws('http://example.com'));
check('worker url: paths, queries, credentials and wildcards are refused', throws('https://a.example.com/v1') && throws('https://a.example.com/?x=1') && throws('https://u:p@a.example.com') && throws('https://*.example.com') && throws('not a url'));
const local = resolveWorkerUrl('http://localhost:8787');
check('worker url: localhost http is a dev-only build (devAllowedDomains, none in production)', local.local && JSON.stringify(networkAccessFor(local).allowedDomains) === '["none"]' && JSON.stringify(networkAccessFor(local).devAllowedDomains) === '["http://localhost:8787"]');
check('manifest: Figma design files only', JSON.stringify(manifest.editorType) === '["figma"]');
check('manifest: current page access model', manifest.documentAccess === 'dynamic-page');

if (failures.length) {
  failures.forEach((f) => console.log(`FAIL  ${f}`));
  process.exit(1);
}
console.log('plugin checks passed');
