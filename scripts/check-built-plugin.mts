// Check the artifact that will be imported into Figma, after build:plugin.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { officialNetworkAccess, OFFICIAL_WORKER_URL } from '../src/lib/worker-url.ts';

const source = JSON.parse(readFileSync('plugin/manifest.json', 'utf8'));
const built = JSON.parse(readFileSync('dist-plugin/manifest.json', 'utf8'));
assert.equal(built.id, source.id, 'The build must preserve the source plugin ID');
assert.deepEqual(built.networkAccess, officialNetworkAccess(), 'Only the official Worker may be allowed');
const html = readFileSync('dist-plugin/ui.html', 'utf8');
assert.ok(html.includes(OFFICIAL_WORKER_URL), 'The UI must contain the official endpoint');
assert.ok(!html.includes('__DECODEIT_WORKER_URL__'), 'No unresolved endpoint injection');
assert.ok(!/\s(?:src|href)=["'](?:https?:|\.{0,2}\/?assets\/)/i.test(html), 'The plugin UI must be self-contained');
for (const file of ['manifest.json', 'code.js', 'ui.html']) {
  const content = readFileSync(`dist-plugin/${file}`, 'utf8');
  assert.ok(!/AIza[0-9A-Za-z_-]{20,}|GEMINI_API_KEY|x-goog-api-key/.test(content), `Secret marker in ${file}`);
  assert.ok(!content.includes('override-must-be-ignored'), `Legacy build override leaked into ${file}`);
}
console.log('built plugin checks passed (official endpoint, source ID, embedded assets, no secret markers)');
