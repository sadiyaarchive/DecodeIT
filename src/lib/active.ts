import { mockProvider } from './decoder.ts';
import type { DecodeProvider } from './decoder.ts';
import { isSimMode, setSimulation, simulated } from './simulate.ts';

/**
 * The provider the app uses. Point this at a real provider when a backend exists.
 * In development it is wrapped so failures can be simulated (see the test switch, or `?simulate=network`).
 */
export const provider: DecodeProvider = import.meta.env.DEV ? simulated(mockProvider) : mockProvider;

if (import.meta.env.DEV) {
  const q = new URLSearchParams(window.location.search).get('simulate');
  if (isSimMode(q)) setSimulation(q);
}
