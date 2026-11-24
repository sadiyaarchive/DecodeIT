import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { callGemini, UpstreamError } from '../src/gemini.ts';
import worker from '../src/index.ts';
import type { DecodeBody, Env } from '../src/types.ts';

const NOW = Date.UTC(2026, 10, 23, 12);
const env: Env = { GEMINI_API_KEY: 'TEST-SECRET', GEMINI_MODEL: 'test-model', ALLOWED_ORIGINS: 'null' };
const body: DecodeBody = {
  comment: 'PRIVATE-PROMPT',
  design: { kind: 'figma-frame', name: 'PRIVATE-NAME', width: 100, height: 100, mimeType: 'image/png', imageBase64: 'UFJJVkFURS1JTUFHRQ==' },
  context: { description: '', audience: '', goal: '', layerSummary: '' },
};
const output = { summary: 'PRIVATE-GENERATED-TEXT', interpretations: [{ label: 'L', meaning: 'M', issues: [], tries: [], why: 'W' }], questions: [], assumptions: [] };
const candidate = (text = JSON.stringify(output), finishReason = 'STOP') => ({ candidates: [{ finishReason, content: { parts: [{ text }] } }] });
const success = () => Response.json(candidate());
const unavailable = (retryAfter?: string) => new Response('PRIVATE-UPSTREAM-ERROR', {
  status: 503, headers: retryAfter === undefined ? {} : { 'retry-after': retryAfter },
});
type Reply = (init: RequestInit) => Response | Promise<Response>;

function setup(t: TestContext, replies: Reply[]) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: NOW });
  t.mock.method(Math, 'random', () => 0.5);
  const calls: RequestInit[] = [];
  const logs: unknown[][] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => logs.push(args));
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    calls.push(init);
    const reply = replies[calls.length - 1];
    assert.ok(reply, 'unexpected extra Gemini request');
    return reply(init);
  });
  const controller = new AbortController();
  const run = (deadline = NOW + 25_000) => callGemini(env, body, controller.signal, deadline);
  return { calls, logs, controller, run };
}

// Let fetch/Response promise continuations settle before advancing the mocked clock.
async function flush() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
const expectError = (promise: Promise<unknown>, status: number, code: string, upstreamStatus: number, category = code) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof UpstreamError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    assert.equal(error.upstreamStatus, upstreamStatus);
    assert.equal(error.category, category);
    return true;
  });

test('first 503 retries once after jitter, succeeds, and reuses payload and signal', async (t) => {
  const h = setup(t, [() => unavailable(), success]);
  const pending = h.run();
  await flush();
  assert.equal(h.calls.length, 1);
  t.mock.timers.tick(1124);
  await flush();
  assert.equal(h.calls.length, 1);
  t.mock.timers.tick(1);
  assert.deepEqual(await pending, output);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0].body, h.calls[1].body);
  assert.equal(h.calls[0].signal, h.calls[1].signal);
  assert.deepEqual(h.logs, [['gemini_error', { upstreamStatus: 503, attempt: 1, elapsedMs: 0, category: 'upstream' }]]);
});

test('two 503 responses stop after exactly two attempts and preserve original status', async (t) => {
  const h = setup(t, [() => unavailable(), () => unavailable()]);
  const checked = expectError(h.run(), 502, 'upstream', 503);
  await flush();
  t.mock.timers.tick(1125);
  await checked;
  t.mock.timers.tick(60_000);
  assert.equal(h.calls.length, 2);
  assert.deepEqual(h.logs[1], ['gemini_error', { upstreamStatus: 503, attempt: 2, elapsedMs: 1125, category: 'upstream' }]);
});

for (const [name, header, delay] of [
  ['seconds', '3', 3000],
  ['HTTP date', new Date(NOW + 5000).toUTCString(), 5000],
  ['zero still uses backoff', '0', 1125],
  ['past date still uses backoff', new Date(NOW - 5000).toUTCString(), 1125],
  ['invalid header uses backoff', 'not-a-date', 1125],
  ['negative header uses backoff', '-1', 1125],
] as const) {
  test(`Retry-After: ${name}`, async (t) => {
    const h = setup(t, [() => unavailable(header), success]);
    const pending = h.run();
    await flush();
    t.mock.timers.tick(delay - 1);
    await flush();
    assert.equal(h.calls.length, 1);
    t.mock.timers.tick(1);
    assert.deepEqual(await pending, output);
    assert.equal(h.calls.length, 2);
  });
}

for (const header of ['25', '60', new Date(NOW + 60_000).toUTCString(), '9'.repeat(400)]) {
  test(`Retry-After exceeding or reaching deadline skips retry (${header.length > 100 ? 'overflow' : header})`, async (t) => {
    const h = setup(t, [() => unavailable(header)]);
    await expectError(h.run(), 502, 'upstream', 503);
    t.mock.timers.tick(60_000);
    assert.equal(h.calls.length, 1);
  });
}

test('insufficient time for ordinary backoff skips retry', async (t) => {
  const h = setup(t, [() => unavailable()]);
  await expectError(h.run(NOW + 1000), 502, 'upstream', 503);
  assert.equal(h.calls.length, 1);
});

test('expired deadline does not start a request', async (t) => {
  const h = setup(t, []);
  await assert.rejects(h.run(NOW), { name: 'TimeoutError' });
  assert.equal(h.calls.length, 0);
});

test('abort during backoff cancels the retry timer', async (t) => {
  const h = setup(t, [() => unavailable()]);
  const checked = assert.rejects(h.run(), { name: 'TimeoutError' });
  await flush();
  h.controller.abort(new DOMException('test deadline', 'TimeoutError'));
  await checked;
  t.mock.timers.tick(60_000);
  assert.equal(h.calls.length, 1);
  assert.equal((h.logs.at(-1)![1] as { category: string }).category, 'timeout');
});

test('delayed retry timer cannot start a request after the deadline', async (t) => {
  const h = setup(t, [() => unavailable()]);
  const checked = assert.rejects(h.run(), { name: 'TimeoutError' });
  await flush();
  t.mock.timers.tick(25_000);
  await checked;
  assert.equal(h.calls.length, 1);
});

test('second request shares the original deadline, not another 25 seconds', async (t) => {
  const h = setup(t, [() => unavailable(), (init) => new Promise((_resolve, reject) => {
    init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
  })]);
  setTimeout(() => h.controller.abort(new DOMException('test deadline', 'TimeoutError')), 25_000);
  const checked = assert.rejects(h.run(), { name: 'TimeoutError' });
  await flush();
  t.mock.timers.tick(1125);
  await flush();
  assert.equal(h.calls.length, 2);
  t.mock.timers.tick(23_875);
  await checked;
  assert.equal(h.calls[1].signal!.aborted, true);
  assert.equal((h.logs.at(-1)![1] as { elapsedMs: number }).elapsedMs, 25_000);
});

test('deadline reached during response body reading is a timeout', async (t) => {
  const h = setup(t, [() => {
    const res = success();
    t.mock.method(res, 'json', async () => {
      t.mock.timers.tick(25_000);
      return candidate();
    });
    return res;
  }]);
  await assert.rejects(h.run(), { name: 'TimeoutError' });
  assert.equal(h.calls.length, 1);
});

for (const status of [400, 401, 403, 404, 408, 429, 500, 502, 504]) {
  test(`HTTP ${status} is never retried`, async (t) => {
    const h = setup(t, [() => new Response('PRIVATE-UPSTREAM-ERROR', { status })]);
    await expectError(h.run(), status === 429 ? 429 : 502, status === 429 ? 'rate_limit' : 'upstream', status);
    assert.equal(h.calls.length, 1);
  });
}

test('transport failure is not retried or logged verbatim', async (t) => {
  const h = setup(t, [() => { throw new TypeError('TEST-SECRET PRIVATE-PROMPT'); }]);
  await assert.rejects(h.run(), TypeError);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.logs, [['gemini_error', { attempt: 1, elapsedMs: 0, category: 'network' }]]);
});

for (const [name, reply, category] of [
  ['invalid outer JSON', () => new Response('PRIVATE-GENERATED-TEXT'), 'invalid_response'],
  ['null envelope', () => Response.json(null), 'missing_output'],
  ['missing candidates', () => Response.json({}), 'missing_output'],
  ['invalid parts shape', () => Response.json({ candidates: [{ content: { parts: {} } }] }), 'missing_output'],
  ['non-text parts', () => Response.json({ candidates: [{ content: { parts: [{ text: {} }, null] } }] }), 'missing_output'],
  ['invalid candidate JSON', () => Response.json(candidate('PRIVATE-GENERATED-TEXT')), 'invalid_json'],
  ['invalid result shape', () => Response.json(candidate('{}')), 'invalid_shape'],
  ['blocked prompt', () => Response.json({ promptFeedback: { blockReason: 'SAFETY' } }), 'blocked_output'],
  ['truncated but parseable output', () => Response.json(candidate(JSON.stringify(output), 'MAX_TOKENS')), 'incomplete_output'],
  ['unsafe finish metadata', () => Response.json(candidate(JSON.stringify(output), 'PRIVATE-GENERATED-TEXT')), 'incomplete_output'],
] as const) {
  test(`${name} returns bad_output without retry`, async (t) => {
    const h = setup(t, [reply]);
    await expectError(h.run(), 502, 'bad_output', 200, category);
    assert.equal(h.calls.length, 1);
    const serialized = JSON.stringify(h.logs);
    for (const privateValue of [env.GEMINI_API_KEY, body.comment, body.design.imageBase64, output.summary]) {
      assert.equal(serialized.includes(privateValue), false);
    }
    for (const [, fields] of h.logs) {
      assert.ok(Object.keys(fields as object).every((key) => ['upstreamStatus', 'attempt', 'elapsedMs', 'category', 'finishReason', 'blockReason'].includes(key)));
    }
  });
}

test('known reasons are logged and unrecognized block reasons are redacted', async (t) => {
  const h = setup(t, [() => Response.json({ ...candidate('', 'SAFETY'), promptFeedback: { blockReason: 'PRIVATE-PROMPT' } })]);
  await expectError(h.run(), 502, 'bad_output', 200, 'blocked_output');
  assert.deepEqual(h.logs, [['gemini_error', {
    upstreamStatus: 200, attempt: 1, elapsedMs: 0, category: 'blocked_output', finishReason: 'SAFETY', blockReason: 'UNKNOWN',
  }]]);
});

test('successful response without optional finish metadata remains compatible', async (t) => {
  const h = setup(t, [() => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }] })]);
  assert.deepEqual(await h.run(), output);
  assert.equal(h.logs.length, 0);
});

function request() {
  return new Request('https://worker.test/v1/decode', {
    method: 'POST', headers: { origin: 'null', 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

for (const [name, replies, status, code] of [
  ['success after retry', [() => unavailable(), success], 200, undefined],
  ['exhausted retry', [() => unavailable(), () => unavailable()], 502, 'upstream'],
  ['bad output', [() => Response.json(candidate('bad'))], 502, 'bad_output'],
  ['malformed envelope', [() => new Response('bad')], 502, 'bad_output'],
  ['quota', [() => new Response('{}', { status: 429 })], 429, 'rate_limit'],
  ['transport failure', [() => { throw new TypeError('TEST-SECRET'); }], 500, 'internal'],
] as const) {
  test(`Worker API compatibility: ${name}`, async (t) => {
    const h = setup(t, [...replies]);
    const pending = worker.fetch(request(), env);
    await flush();
    if (replies.length === 2) t.mock.timers.tick(1125);
    const res = await pending;
    assert.equal(res.status, status);
    assert.equal(res.headers.get('access-control-allow-origin'), 'null');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const data = await res.json();
    if (code) {
      assert.deepEqual(Object.keys(data), ['error']);
      assert.deepEqual(Object.keys(data.error).sort(), ['code', 'message']);
      assert.equal(data.error.code, code);
      assert.equal(data.error.message, code === 'rate_limit' ? 'The AI service is busy. Try again shortly.' :
        code === 'internal' ? 'Unexpected error.' : 'The AI service could not decode that. Try again.');
    } else assert.deepEqual(data, { ...output, model: env.GEMINI_MODEL });
    assert.equal(JSON.stringify(h.logs).includes('TEST-SECRET'), false);
    assert.equal(h.calls.length, replies.length);
  });
}

test('Worker retains a single 25000ms timeout and the existing 504 response', async (t) => {
  const h = setup(t, [() => unavailable(), (init) => new Promise((_resolve, reject) => {
    init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
  })]);
  const timeouts: number[] = [];
  t.mock.method(AbortSignal, 'timeout', (ms: number) => {
    timeouts.push(ms);
    setTimeout(() => h.controller.abort(new DOMException('deadline', 'TimeoutError')), ms);
    return h.controller.signal;
  });
  const pending = worker.fetch(request(), env);
  await flush();
  t.mock.timers.tick(1125);
  await flush();
  t.mock.timers.tick(23_875);
  const res = await pending;
  assert.equal(res.status, 504);
  assert.deepEqual(await res.json(), { error: { code: 'timeout', message: 'The AI service did not answer in time.' } });
  assert.deepEqual(timeouts, [25_000]);
  assert.equal(h.calls.length, 2);
});
