import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBody, sanitizeOutput } from '../src/validate.ts';

const good = { comment: 'Make it pop', design: { kind: 'figma-frame', name: 'Home', width: 390, height: 844, mimeType: 'image/png', imageBase64: 'aGVsbG8=' }, context: {} };

test('accepts a valid body', () => assert.equal(parseBody(good, 1000).ok, true));
test('rejects missing image', () => assert.equal(parseBody({ ...good, design: undefined }, 1000).ok, false));
test('rejects data: URL prefix', () => assert.equal(parseBody({ ...good, design: { ...good.design, imageBase64: 'data:image/png;base64,AA' } }, 1000).ok, false));
test('rejects oversize image', () => assert.equal(parseBody(good, 2).ok, false));
test('rejects gibberish feedback', () => assert.equal(parseBody({ ...good, comment: '12 !!' }, 1000).ok, false));
test('sanitize rejects wrong shape', () => assert.equal(sanitizeOutput({ summary: 'x' }), null));
test('sanitize trims to shape', () => {
  const o = sanitizeOutput({ summary: 's', interpretations: [{ label: 'a', meaning: 'b', issues: ['i'], tries: ['t'], why: 'w', extra: 1 }], questions: [], assumptions: [] });
  assert.deepEqual(Object.keys(o!.interpretations[0]!).sort(), ['issues', 'label', 'meaning', 'tries', 'why']);
});
