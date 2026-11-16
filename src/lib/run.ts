import { DecodeError } from './decoder.ts';
import type { DecodeProvider, DecodeRequest, DecodeResult } from './decoder.ts';

/** How a decode attempt ended. Cancelling is not an error. */
export type RunOutcome =
  | { status: 'ok'; result: DecodeResult }
  | { status: 'error'; error: DecodeError }
  | { status: 'cancelled' };

export interface RunOptions {
  provider: DecodeProvider;
  request: DecodeRequest;
  /** Abort to cancel. The run then resolves as `cancelled`. */
  signal?: AbortSignal;
  /** Give up after this long and report a `timeout` error. */
  timeoutMs?: number;
  /** Call `onSlow` once if the provider has not answered by then. */
  slowAfterMs?: number;
  onSlow?: () => void;
  /** Hold the outcome back this long, so a fast answer does not flash the working state. */
  minMs?: number;
}

export const DEFAULT_LIMITS = { timeoutMs: 20000, slowAfterMs: 4000, minMs: 1500 };

const aborted = () => new DOMException('Aborted', 'AbortError');

/** Resolves at `until` (ms since epoch), or sooner if `signal` aborts. */
function holdUntil(until: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const wait = until - Date.now();
    if (wait <= 0 || signal?.aborted) return resolve();
    const done = () => {
      clearTimeout(t);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const t = setTimeout(done, wait);
    signal?.addEventListener('abort', done, { once: true });
  });
}

/**
 * Runs one decode and always settles with an outcome, whatever the provider does: it may fail,
 * hang, or ignore the abort signal. Timeouts, the slow warning and cancellation live here so
 * they behave the same for the demo and for any real provider.
 */
export async function runDecode(o: RunOptions): Promise<RunOutcome> {
  const { provider, request, signal, onSlow } = o;
  const timeoutMs = o.timeoutMs ?? DEFAULT_LIMITS.timeoutMs;
  const slowAfterMs = o.slowAfterMs ?? DEFAULT_LIMITS.slowAfterMs;
  const minMs = o.minMs ?? DEFAULT_LIMITS.minMs;

  if (signal?.aborted) return { status: 'cancelled' };

  const inner = new AbortController();
  let timedOut = false;
  const forwardAbort = () => inner.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });
  const slowTimer = setTimeout(() => onSlow?.(), slowAfterMs);
  const timeoutTimer = setTimeout(() => {
    timedOut = true;
    inner.abort();
  }, timeoutMs);
  const started = Date.now();

  // Rejects when the run is aborted, even if the provider never looks at the signal.
  const abortedPromise = new Promise<never>((_, reject) => {
    inner.signal.addEventListener('abort', () => reject(aborted()), { once: true });
  });
  abortedPromise.catch(() => {});

  try {
    const result = await Promise.race([provider.decode(request, { signal: inner.signal }), abortedPromise]);
    await holdUntil(started + minMs, signal);
    if (signal?.aborted) return { status: 'cancelled' };
    return { status: 'ok', result };
  } catch (e) {
    if (signal?.aborted) return { status: 'cancelled' };
    if (timedOut) {
      return { status: 'error', error: new DecodeError('The decoder did not answer in time.', 'timeout') };
    }
    await holdUntil(started + minMs, signal);
    if (signal?.aborted) return { status: 'cancelled' };
    return { status: 'error', error: e instanceof DecodeError ? e : new DecodeError('Unexpected error.', 'unknown') };
  } finally {
    clearTimeout(slowTimer);
    clearTimeout(timeoutTimer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

export interface ErrorCopy {
  kind: DecodeError['kind'];
  title: string;
  body: string;
  /** Whether trying the same feedback again can help. If not, the user has to change something first. */
  retryable: boolean;
}

/** What to tell the user. Only `input` errors show provider text; the rest never leak raw messages. */
export function describeError(error: DecodeError): ErrorCopy {
  switch (error.kind) {
    case 'input':
      return { kind: error.kind, title: "Couldn't decode that feedback", body: error.message, retryable: false };
    case 'no_match':
      return {
        kind: error.kind,
        title: 'Not in the demo yet',
        body: 'The demo only has readings for its sample scenarios. Pick one below to see how Decode It works.',
        retryable: false,
      };
    case 'network':
      return { kind: error.kind, title: "Couldn't reach the decoder", body: 'Check your connection, then try again. Your feedback is still here.', retryable: true };
    case 'timeout':
      return { kind: error.kind, title: 'That took too long', body: "The decoder didn't answer in time. Try again, or shorten the feedback.", retryable: true };
    case 'rate_limit':
      return { kind: error.kind, title: 'Too many requests', body: 'Wait a moment, then try again.', retryable: true };
    case 'server':
      return { kind: error.kind, title: 'The decoder had a problem', body: 'This is on our side. Try again in a moment.', retryable: true };
    default:
      return { kind: error.kind, title: 'Something went wrong', body: 'Try again. Your feedback is still here.', retryable: true };
  }
}
