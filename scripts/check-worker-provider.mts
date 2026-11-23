// Checks the Worker-backed provider against a fake `fetch`. Makes no network request.
//   node scripts/check-worker-provider.mts
import { DecodeError } from '../src/lib/decoder.ts';
import type { DecodeRequest } from '../src/lib/decoder.ts';
import { runDecode, describeError } from '../src/lib/run.ts';
import { assertImageAllowed, blobToBase64, createWorkerProvider, OFFICIAL_WORKER_URL } from '../src/lib/worker-provider.ts';

const failures: string[] = [];
const check = (name: string, ok: boolean) => ok || failures.push(name);

const png = (n = 8, type = 'image/png') => new Blob([new Uint8Array(n).fill(7)], { type });
const req = (over: Partial<DecodeRequest> = {}): DecodeRequest => ({
  comment: 'Can we make this feel more premium?',
  design: { kind: 'figma-frame', name: 'Home', width: 390, height: 844, image: png() },
  context: { description: ' Pricing page ', audience: '', goal: 'Start a trial' },
  ...over,
});
const GOOD = {
  summary: 'S',
  interpretations: [{ label: 'L', meaning: 'M', issues: ['i'], tries: ['t'], why: 'W' }],
  questions: ['Q?'],
  assumptions: ['A'],
  model: 'gemini-test',
};
const reply = (status: number, body: unknown): Response => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
const fast = { minMs: 0, slowAfterMs: 10_000, timeoutMs: 10_000 };
const run = (fetchImpl: typeof fetch, r = req()) => runDecode({ provider: createWorkerProvider({ fetch: fetchImpl }), request: r, ...fast });

// request contract
let seen: { url: string; init: RequestInit } | undefined;
let o = await run(async (url, init) => ((seen = { url: String(url), init: init! }), reply(200, GOOD)));
const sent = JSON.parse(String(seen?.init.body));
check('posts only to the official Worker decode endpoint', seen?.url === `${OFFICIAL_WORKER_URL}/v1/decode`);
check('method POST with JSON content type', seen?.init.method === 'POST' && (seen.init.headers as Record<string, string>)['content-type'] === 'application/json');
check('no api key or auth header is sent', !JSON.stringify(seen?.init.headers).toLowerCase().match(/key|authorization/));
check('body has comment, design, context', sent.comment.startsWith('Can we') && sent.design.kind === 'figma-frame' && sent.design.name === 'Home' && sent.design.width === 390 && sent.context.layerSummary === '');
check('image is base64 with no data: prefix', sent.design.imageBase64 === Buffer.from(new Uint8Array(8).fill(7)).toString('base64') && !sent.design.imageBase64.startsWith('data:'));
check('mimeType comes from the blob', sent.design.mimeType === 'image/png');
check('notes are trimmed', sent.context.description === 'Pricing page' && sent.context.goal === 'Start a trial');
check('the production Worker URL is https', OFFICIAL_WORKER_URL.startsWith('https://'));

// response mapping
if (o.status !== 'ok') failures.push('success maps to ok');
else {
  const r = o.result;
  check('result is not marked demo', r.source.isDemo === false && r.source.id === 'gemini' && r.source.label.includes('gemini-test'));
  check('readings, questions, assumptions pass through', r.summary === 'S' && r.interpretations.length === 1 && r.questions[0] === 'Q?' && r.assumptions[0] === 'A');
  check('observed starts with the design and lists given notes', r.observed[0] === 'Design: Figma frame "Home", 390 × 844' && r.observed.some((x) => x.startsWith('What it is')));
  check('context use says everything provided was sent to Gemini', r.contextUse.used.join() === r.contextUse.provided.join() && /Gemini/.test(r.contextUse.note) && !r.missingContext);
}
o = await run(async () => reply(200, GOOD), req({ context: { description: '', audience: '', goal: '' } }));
check('missingContext when no notes', o.status === 'ok' && o.result.missingContext);

// error mapping
const kindOf = async (f: typeof fetch) => {
  const out = await run(f);
  return out.status === 'error' ? out.error.kind : out.status;
};
const err = (status: number, code: string) => async () => reply(status, { error: { code, message: 'msg' } });
check('400 invalid_input -> input', (await kindOf(err(400, 'invalid_input'))) === 'input');
check('413 too_large -> image', (await kindOf(err(413, 'too_large'))) === 'image');
check('429 rate_limit -> rate_limit', (await kindOf(err(429, 'rate_limit'))) === 'rate_limit');
check('504 timeout -> timeout', (await kindOf(err(504, 'timeout'))) === 'timeout');
for (const [s, c] of [[502, 'upstream'], [502, 'bad_output'], [500, 'internal'], [500, 'not_configured'], [403, 'forbidden_origin'], [415, 'bad_content_type'], [404, 'not_found']] as const) {
  check(`${s} ${c} -> server`, (await kindOf(err(s, c))) === 'server');
}
check('an HTML error page -> server', (await kindOf(async () => reply(502, '<html>Bad gateway</html>'))) === 'server');
check('fetch failure -> network', (await kindOf(async () => { throw new TypeError('Failed to fetch'); })) === 'network');
check('200 with a wrong shape -> server', (await kindOf(async () => reply(200, { summary: 'x' }))) === 'server');
check('200 with non-JSON -> server', (await kindOf(async () => reply(200, 'nope'))) === 'server');
o = await run(err(502, 'upstream'));
check('server errors never leak the worker message', o.status === 'error' && describeError(o.error).body.indexOf('msg') === -1);

// client-side validation: nothing is fetched
let calls = 0;
const counting: typeof fetch = async () => (calls++, reply(200, GOOD));
o = await run(counting, req({ design: { kind: 'screenshot', name: 'big.png', width: 1, height: 1, image: png(4_000_001) } }));
check('over 4 MB is rejected before fetch with an image error', calls === 0 && o.status === 'error' && o.error.kind === 'image' && describeError(o.error).retryable);
o = await run(counting, req({ design: { kind: 'screenshot', name: 'ok.png', width: 1, height: 1, image: png(4_000_000) } }));
check('exactly 4 MB is accepted', o.status === 'ok');
calls = 0;
o = await run(counting, req({ design: { kind: 'screenshot', name: 'a.gif', width: 1, height: 1, image: png(10, 'image/gif') } }));
check('unsupported image type is rejected before fetch', calls === 0 && o.status === 'error' && o.error.kind === 'input');
o = await run(counting, req({ comment: '12345' }));
check('unreadable feedback is rejected before fetch', calls === 0 && o.status === 'error' && o.error.kind === 'input');
let threw: unknown;
try { assertImageAllowed(png(5_000_000)); } catch (e) { threw = e; }
check('assertImageAllowed throws DecodeError', threw instanceof DecodeError);
check('large blobs encode without overflowing', (await blobToBase64(png(3_000_000))).length === Math.ceil(3_000_000 / 3) * 4);

// cancellation reaches fetch
const ac = new AbortController();
let gotSignal: AbortSignal | undefined;
const pending = runDecode({
  provider: createWorkerProvider({ fetch: (_u, init) => ((gotSignal = init?.signal ?? undefined), new Promise<Response>((_, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError'))))) }),
  request: req(), signal: ac.signal, ...fast,
});
await new Promise((r) => setTimeout(r, 20));
ac.abort();
check('cancel aborts the fetch and resolves cancelled', (await pending).status === 'cancelled' && gotSignal?.aborted === true);

if (failures.length) {
  failures.forEach((f) => console.log(`FAIL  ${f}`));
  process.exit(1);
}
console.log('worker provider checks passed');
