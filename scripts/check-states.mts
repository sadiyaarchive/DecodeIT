// Checks how a decode ends: success, each failure kind, timeout, slow warning, cancellation,
// and providers that misbehave. No dependencies:
//   node scripts/check-states.mts
import { DecodeError, mockProvider } from '../src/lib/decoder.ts';
import type { DecodeProvider, DecodeRequest } from '../src/lib/decoder.ts';
import { describeError, runDecode } from '../src/lib/run.ts';
import { setSimulation, simulated } from '../src/lib/simulate.ts';

const failures: string[] = [];
const check = (name: string, ok: boolean) => ok || failures.push(name);

const req = (comment = 'Can we make it pop?'): DecodeRequest => ({
  comment,
  design: { kind: 'figma-frame', name: 'Home', width: 390, height: 844, image: new Blob([new Uint8Array([1])], { type: 'image/png' }) },
  context: { description: '', audience: '', goal: '' },
});
const fast = { minMs: 0, slowAfterMs: 10_000, timeoutMs: 10_000 };
const provider = (decode: DecodeProvider['decode']): DecodeProvider => ({ id: 't', label: 't', isDemo: true, decode });

// success, and the minimum hold
let t = Date.now();
let o = await runDecode({ provider: mockProvider, request: req(), ...fast, minMs: 200 });
check('success returns a result', o.status === 'ok' && o.result.interpretations.length > 0);
check('minMs holds a fast answer back', Date.now() - t >= 190);

// the demo's own rejections
o = await runDecode({ provider: mockProvider, request: req('12345'), ...fast });
check('digits-only comment is an input error', o.status === 'error' && o.error.kind === 'input');
o = await runDecode({ provider: mockProvider, request: req('word '.repeat(300)), ...fast });
check('over-long comment is an input error', o.status === 'error' && o.error.kind === 'input' && /longer than/.test(o.error.message));

// the design is required: a request without one is rejected, and so is an empty image
const noDesign = { ...req(), design: undefined } as unknown as DecodeRequest;
o = await runDecode({ provider: mockProvider, request: noDesign, ...fast });
check('no design: rejected as an input error', o.status === 'error' && o.error.kind === 'input' && /design/i.test(o.error.message));
o = await runDecode({ provider: mockProvider, request: { ...req(), design: { ...req().design, image: new Blob([]) } }, ...fast });
check('an empty image: rejected as an input error', o.status === 'error' && o.error.kind === 'input');

// feedback the demo has no scenario for is declined honestly, not answered with filler
o = await runDecode({ provider: mockProvider, request: req('Make it feel lighter'), ...fast });
check('unmatched feedback is a no_match error', o.status === 'error' && o.error.kind === 'no_match');
const noMatchCopy = describeError(new DecodeError('x', 'no_match'));
check('no_match copy says it is the demo and cannot be retried', /demo/i.test(noMatchCopy.body) && !noMatchCopy.retryable && noMatchCopy.title === 'Not in the demo yet');

// each failure kind passes through; anything else becomes `unknown` and loses its raw text
for (const kind of ['network', 'rate_limit', 'server'] as const) {
  o = await runDecode({ provider: provider(async () => { throw new DecodeError('raw ' + kind, kind); }), request: req(), ...fast });
  check(`${kind} error keeps its kind`, o.status === 'error' && o.error.kind === kind);
}
o = await runDecode({ provider: provider(async () => { throw new Error('secret stack trace'); }), request: req(), ...fast });
check('unexpected exception becomes an unknown error', o.status === 'error' && o.error.kind === 'unknown');
check('unexpected exception text is dropped', o.status === 'error' && !o.error.message.includes('secret'));

// user-facing copy: only input errors show provider text
for (const kind of ['network', 'timeout', 'rate_limit', 'server', 'unknown'] as const) {
  const c = describeError(new DecodeError('RAW INTERNAL TEXT', kind));
  check(`${kind} copy hides raw text and can be retried`, !c.body.includes('RAW') && c.retryable);
}
const inputCopy = describeError(new DecodeError('Please rephrase.', 'input'));
check('input copy shows the provider message and is not retryable', inputCopy.body === 'Please rephrase.' && !inputCopy.retryable);

// timeout: even a provider that ignores the abort signal must not hang the run
t = Date.now();
o = await runDecode({ provider: provider(() => new Promise(() => {})), request: req(), minMs: 0, slowAfterMs: 50, timeoutMs: 300 });
check('a stuck provider times out', o.status === 'error' && o.error.kind === 'timeout');
check('timeout fires on time', Date.now() - t >= 290 && Date.now() - t < 1000);

// slow warning fires once, then a late answer still succeeds
let slowCalls = 0;
o = await runDecode({
  provider: provider(async (r, opts) => { await new Promise((res) => setTimeout(res, 250)); return mockProvider.decode(r, opts); }),
  request: req(), minMs: 0, slowAfterMs: 100, timeoutMs: 5000, onSlow: () => slowCalls++,
});
check('slow warning fires once', slowCalls === 1);
check('a slow answer still succeeds', o.status === 'ok');
slowCalls = 0;
await runDecode({ provider: mockProvider, request: req(), minMs: 0, slowAfterMs: 5000, timeoutMs: 5000, onSlow: () => slowCalls++ });
check('no slow warning for a fast answer', slowCalls === 0);

// cancellation: mid-flight, before start, and against a provider that ignores the signal
let c = new AbortController();
let p = runDecode({ provider: provider(() => new Promise(() => {})), request: req(), signal: c.signal, ...fast });
setTimeout(() => c.abort(), 100);
check('cancelling a stuck provider cancels the run', (await p).status === 'cancelled');
c = new AbortController(); c.abort();
check('already-cancelled signal cancels immediately', (await runDecode({ provider: mockProvider, request: req(), signal: c.signal, ...fast })).status === 'cancelled');
c = new AbortController();
p = runDecode({ provider: mockProvider, request: req(), signal: c.signal, ...fast, minMs: 400 });
setTimeout(() => c.abort(), 100);
t = Date.now();
check('cancelling during the minimum hold cancels', (await p).status === 'cancelled' && Date.now() - t < 350);
c = new AbortController();
p = runDecode({ provider: provider(async () => { await new Promise((r) => setTimeout(r, 100)); throw new DecodeError('x', 'network'); }), request: req(), signal: c.signal, ...fast });
setTimeout(() => c.abort(), 30);
check('cancelling before a failure reports cancelled, not an error', (await p).status === 'cancelled');

// the dev simulation wrapper
const sim = simulated(mockProvider);
setSimulation('network');
o = await runDecode({ provider: sim, request: req(), ...fast });
check('simulated network error', o.status === 'error' && o.error.kind === 'network');
setSimulation('unknown');
o = await runDecode({ provider: sim, request: req(), ...fast });
check('simulated unexpected error is sanitised', o.status === 'error' && o.error.kind === 'unknown' && !o.error.message.includes('boom'));
setSimulation('stuck');
o = await runDecode({ provider: sim, request: req(), minMs: 0, slowAfterMs: 50, timeoutMs: 250 });
check('simulated stuck provider times out', o.status === 'error' && o.error.kind === 'timeout');
setSimulation('hang');
c = new AbortController();
p = runDecode({ provider: sim, request: req(), signal: c.signal, ...fast });
setTimeout(() => c.abort(), 80);
check('simulated hang can be cancelled', (await p).status === 'cancelled');
setSimulation('off');
o = await runDecode({ provider: sim, request: req(), ...fast });
check('simulation off behaves normally', o.status === 'ok');

if (failures.length) {
  failures.forEach((f) => console.log(`FAIL  ${f}`));
  process.exit(1);
}
console.log('state checks passed');
