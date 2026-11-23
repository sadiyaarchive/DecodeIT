import { mockProvider } from './decoder.ts';
import type { DecodeProvider } from './decoder.ts';
import { isSimMode, setSimulation, simulated } from './simulate.ts';
import { createWorkerProvider } from './worker-provider.ts';

/** `live` sends the design and feedback to the Worker (Gemini). `demo` is the built-in sample scenarios; nothing is sent. */
export type ProviderMode = 'live' | 'demo';

const base: Record<ProviderMode, DecodeProvider> = {
  live: createWorkerProvider(),
  demo: mockProvider,
};

// In development each provider is wrapped so failures can be simulated (see the test switch, or `?simulate=network`).
const wrapped: Record<ProviderMode, DecodeProvider> = {
  live: import.meta.env.DEV ? simulated(base.live) : base.live,
  demo: import.meta.env.DEV ? simulated(base.demo) : base.demo,
};

export const providerFor = (mode: ProviderMode): DecodeProvider => wrapped[mode];

/** Live by default. In development `?provider=demo` starts in demo mode. */
export function initialMode(): ProviderMode {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('provider') === 'demo') return 'demo';
  return 'live';
}

if (import.meta.env.DEV) {
  const q = new URLSearchParams(window.location.search).get('simulate');
  if (isSimMode(q)) setSimulation(q);
}
