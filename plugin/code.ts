// Decode It plugin code. This is the only part that runs inside Figma and can see the document.
// It watches what is selected, exports a preview of the selected frame, and tells the UI.
// It does not read comments or change the document, and it makes no network requests itself (the UI
// sends the design to the Decode It Worker only after the user agrees). It remembers that agreement
// in figma.clientStorage.

import { isUiToPlugin, PROTOCOL_VERSION } from '../src/lib/figma/protocol';
import type { PluginToUi, SelectionState } from '../src/lib/figma/protocol';
import { classifySelection, previewScale } from '../src/lib/figma/selection';

figma.showUI(__html__, { width: 380, height: 680, title: 'Decode It' });
console.info('[Decode It][plugin] Plugin launched');

/** Bump the suffix whenever the consent wording changes in a way people should re-approve. */
const CONSENT_KEY = 'decode-it-consent-v1';

let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

function post(message: PluginToUi) {
  console.info('[Decode It][plugin] Sending message to UI:', message.type === 'selection' ? { type: message.type, seq: message.seq, kind: message.state.kind } : message);
  figma.ui.postMessage(message);
}

function send(mySeq: number, state: SelectionState) {
  post({ type: 'selection', seq: mySeq, state });
}

async function publishSelection(reason: 'initial' | 'change' | 'refresh' = 'change') {
  const mySeq = ++seq;
  const selected = figma.currentPage.selection;
  console.info(
    `[Decode It][plugin] ${reason === 'initial' ? 'Initial selection detected' : 'Selection changed'} (${selected.length} node(s)):`,
    selected.map((n) => ({ id: n.id, type: n.type })),
  );
  const c = classifySelection(
    selected.map((n) => ({ id: n.id, name: n.name, type: n.type, width: 'width' in n ? n.width : 0, height: 'height' in n ? n.height : 0 })),
  );
  if (c.kind !== 'candidate') {
    send(mySeq, c);
    return;
  }
  const { node: info } = c;
  console.info('[Decode It][plugin] Selected candidate node:', { id: info.id, type: info.type, width: info.width, height: info.height });
  send(mySeq, { kind: 'loading', id: info.id, name: info.name, nodeType: info.type, width: info.width, height: info.height });
  try {
    const liveNode = selected.find((n) => n.id === info.id) ?? selected[0];
    const node = liveNode ?? (await figma.getNodeByIdAsync(info.id));
    if (!node || !('exportAsync' in node)) throw new Error('The frame is no longer available.');
    const scale = previewScale(info.width, info.height);
    const image = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale } });
    console.info('[Decode It][plugin] Preview export succeeded:', { id: info.id, byteLength: image.byteLength, scale });
    if (mySeq !== seq) return; // the selection changed while exporting
    send(mySeq, {
      kind: 'frame',
      id: info.id,
      name: info.name,
      nodeType: info.type,
      width: Math.round(info.width),
      height: Math.round(info.height),
      image,
      imageWidth: Math.round(info.width * scale),
      imageHeight: Math.round(info.height * scale),
    });
  } catch (e) {
    console.error('[Decode It][plugin] Preview export failed:', { id: info.id, error: e instanceof Error ? e.message : String(e) });
    if (mySeq !== seq) return;
    send(mySeq, { kind: 'error', name: info.name, message: e instanceof Error && e.message ? e.message : 'Could not read the selected frame.' });
  }
}

/** Selection changes can come in bursts (a drag, a marquee), so wait a moment before exporting. */
function publishSoon() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void publishSelection('change'), 150);
}

figma.on('selectionchange', publishSoon);
figma.on('currentpagechange', publishSoon);

figma.ui.onmessage = (msg: unknown) => {
  if (!isUiToPlugin(msg)) return;
  if (msg.type === 'ui-ready') {
    post({ type: 'host-ready', host: 'figma', protocol: PROTOCOL_VERSION });
    void publishSelection('initial');
  } else if (msg.type === 'refresh-selection') {
    void publishSelection('refresh');
  } else if (msg.type === 'notify') {
    figma.notify(msg.text);
  } else if (msg.type === 'get-consent') {
    void figma.clientStorage
      .getAsync(CONSENT_KEY)
      .then((v) => post({ type: 'consent', accepted: v === true }))
      .catch(() => post({ type: 'consent', accepted: false }));
  } else if (msg.type === 'set-consent') {
    void figma.clientStorage.setAsync(CONSENT_KEY, msg.accepted).catch(() => {});
  }
};

// Proactively announce the host and initial selection as soon as the UI iframe initializes.
post({ type: 'host-ready', host: 'figma', protocol: PROTOCOL_VERSION });
void publishSelection('initial');
