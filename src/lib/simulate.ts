import { DecodeError } from './decoder.ts';
import type { DecodeProvider } from './decoder.ts';

/**
 * Test switch for the failure paths. Development only: `active.ts` wraps the provider in
 * `simulated()` only when `import.meta.env.DEV` is true, so none of this runs in a production build.
 */
export type SimMode = 'off' | 'slow' | 'hang' | 'stuck' | 'network' | 'rate_limit' | 'server' | 'unknown' | 'input';

export const SIM_LABELS: Record<SimMode, string> = {
  off: 'Off (normal)',
  slow: 'Slow answer (6 s)',
  hang: 'Never answers, honours cancel',
  stuck: 'Never answers, ignores cancel',
  network: 'Network error',
  rate_limit: 'Rate limited',
  server: 'Server error',
  unknown: 'Unexpected error',
  input: 'Rejected input',
};

let mode: SimMode = 'off';
export const getSimulation = (): SimMode => mode;
export const setSimulation = (m: SimMode): void => {
  mode = m;
};
export const isSimMode = (v: string | null): v is SimMode => !!v && v in SIM_LABELS;

/** While a failure is simulated, use short limits so slow and timeout states are quick to reach. */
export const simLimits = () =>
  mode === 'off' ? undefined : { slowAfterMs: 1500, timeoutMs: mode === 'slow' ? 15000 : 5000, minMs: 500 };

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function simulated(base: DecodeProvider): DecodeProvider {
  return {
    ...base,
    async decode(req, opts) {
      switch (mode) {
        case 'slow':
          await delay(6000, opts?.signal);
          return base.decode(req, opts);
        case 'hang':
          await new Promise<never>((_, reject) => {
            opts?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
          });
          return base.decode(req, opts);
        case 'stuck':
          await new Promise<never>(() => {});
          return base.decode(req, opts);
        case 'network':
          await delay(600, opts?.signal);
          throw new DecodeError('Failed to fetch', 'network');
        case 'rate_limit':
          await delay(600, opts?.signal);
          throw new DecodeError('429', 'rate_limit');
        case 'server':
          await delay(600, opts?.signal);
          throw new DecodeError('500 internal error: stack trace', 'server');
        case 'unknown':
          await delay(600, opts?.signal);
          throw new Error('boom: raw exception text that must never reach the UI');
        case 'input':
          await delay(300, opts?.signal);
          throw new DecodeError('That comment looks like a different kind of feedback. Try rephrasing it.', 'input');
        default:
          return base.decode(req, opts);
      }
    },
  };
}
