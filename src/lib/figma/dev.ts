// DEVELOPMENT ONLY. A stand-in for the plugin code so every selection state can be tried in a
// browser tab. It speaks exactly the same messages as plugin/code.ts. It is never imported by a
// production or plugin build (the import in main.tsx is behind `import.meta.env.DEV`), and the UI
// cannot tell it apart from the real thing, so it does not change what the product does in Figma.

import { PROTOCOL_VERSION } from './protocol.ts';
import type { PluginToUi, SelectionState } from './protocol.ts';
import { enableDevHostBridge } from './host.ts';

export type SimHostMode = 'off' | 'none' | 'frame' | 'slow-frame' | 'multiple' | 'unsupported' | 'error';

export const SIM_HOST_LABELS: Record<SimHostMode, string> = {
  off: 'Not in Figma (plain browser)',
  none: 'Figma: nothing selected',
  frame: 'Figma: one frame selected',
  'slow-frame': 'Figma: frame, slow export',
  multiple: 'Figma: three layers selected',
  unsupported: 'Figma: a text layer selected',
  error: 'Figma: export fails',
};

let mode: SimHostMode = 'off';
let seq = 0;
let png: Promise<Uint8Array> | null = null;

export const getSimHost = () => mode;

function makePng(): Promise<Uint8Array> {
  png ??= new Promise((resolve) => {
    const c = document.createElement('canvas');
    c.width = 390;
    c.height = 520;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 390, 520);
    g.fillStyle = '#d7d7e0';
    g.fillRect(24, 28, 150, 16);
    g.fillStyle = '#ececf1';
    for (let i = 0; i < 5; i++) g.fillRect(24, 80 + i * 26, i % 2 ? 300 : 342, 10);
    g.fillStyle = '#b9a9f2';
    g.fillRect(24, 250, 120, 36);
    g.fillStyle = '#f1f1f5';
    g.fillRect(24, 330, 342, 150);
    c.toBlob(async (b) => resolve(new Uint8Array(await b!.arrayBuffer())), 'image/png');
  });
  return png;
}

function post(message: PluginToUi) {
  window.postMessage({ pluginMessage: message }, '*');
}
const send = (state: SelectionState) => post({ type: 'selection', seq: ++seq, state });

async function publish() {
  switch (mode) {
    case 'none':
      return send({ kind: 'none' });
    case 'multiple':
      return send({ kind: 'multiple', count: 3 });
    case 'unsupported':
      return send({ kind: 'unsupported', nodeType: 'TEXT', name: 'Heading' });
    case 'error':
      send({ kind: 'loading', id: '1:2', name: 'Home', nodeType: 'FRAME', width: 390, height: 520 });
      return setTimeout(() => send({ kind: 'error', name: 'Home', message: 'The frame is no longer available.' }), 300);
    case 'frame':
    case 'slow-frame': {
      const info = { id: '1:2', name: 'Home', nodeType: 'FRAME', width: 390, height: 520 };
      send({ kind: 'loading', ...info });
      if (mode === 'slow-frame') await new Promise((r) => setTimeout(r, 2500));
      return send({ kind: 'frame', ...info, image: await makePng(), imageWidth: 390, imageHeight: 520 });
    }
    default:
  }
}

/** Starts answering the UI's handshake, like the plugin code does. Call once, before the UI mounts. */
export function installSimHost(initial: SimHostMode = 'off') {
  enableDevHostBridge();
  mode = initial;
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const m = e.data?.pluginMessage;
    if (!m || mode === 'off') return;
    if (m.type === 'ui-ready') {
      post({ type: 'host-ready', host: 'figma', protocol: PROTOCOL_VERSION, simulated: true });
      void publish();
    } else if (m.type === 'refresh-selection') {
      void publish();
    }
  });
}

/** Changes what the stand-in reports, like selecting something else on the canvas. */
export function setSimHost(next: SimHostMode) {
  const wasOff = mode === 'off';
  mode = next;
  if (next === 'off') {
    post({ type: 'host-off' });
    return;
  }
  if (wasOff) post({ type: 'host-ready', host: 'figma', protocol: PROTOCOL_VERSION, simulated: true });
  void publish();
}

export const isSimHostMode = (v: string | null): v is SimHostMode => !!v && v in SIM_HOST_LABELS;
