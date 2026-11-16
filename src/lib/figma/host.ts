import { useCallback, useEffect, useRef, useState } from 'react';
import { isPluginToUi, toUint8Array } from './protocol.ts';
import type { SelectionState, UiToPlugin } from './protocol.ts';

/** `pending` until the plugin answers; `none` means this page is not running inside Figma. */
export type HostKind = 'pending' | 'figma' | 'none';

/** The selection as the UI uses it: the exported image is already turned into something displayable. */
export type UiSelection =
  | Exclude<SelectionState, { kind: 'frame' }>
  | {
      kind: 'frame';
      id: string;
      name: string;
      nodeType: string;
      width: number;
      height: number;
      imageWidth: number;
      imageHeight: number;
      blob: Blob;
      previewUrl: string;
    };

const HANDSHAKE_MS = 900;
let devBridgeEnabled = false;

/** Called by the dev-only simulator so messages can also travel within the current window when previewed in an iframe. */
export function enableDevHostBridge() {
  devBridgeEnabled = true;
}

/** Sends a message to the plugin code. Inside Figma `parent` is Figma; in a plain browser it is the page itself. */
export function sendToPlugin(message: UiToPlugin) {
  parent.postMessage({ pluginMessage: message }, '*');
  if (devBridgeEnabled && parent !== window) {
    window.postMessage({ pluginMessage: message }, '*');
  }
}

/**
 * Talks to the plugin code: asks whether Figma is there, then follows the selection.
 * Only replies that come from the parent window and match the protocol are used.
 */
export function useFigmaHost() {
  const [host, setHost] = useState<HostKind>('pending');
  const [simulated, setSimulated] = useState(false);
  const [selection, setSelection] = useState<UiSelection>({ kind: 'none' });
  const [selectionVersion, setSelectionVersion] = useState(0);
  const lastSeq = useRef(-1);
  const urlRef = useRef<string | null>(null);

  const setUrl = (url: string | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
  };

  useEffect(() => {
    let settled = false;
    const onMessage = (e: MessageEvent) => {
      const msg = e.data?.pluginMessage;
      if (!isPluginToUi(msg)) return;
      const fromSameWindow = e.source === window;
      if (fromSameWindow && !devBridgeEnabled) return;
      const isSim = fromSameWindow || ('simulated' in msg && Boolean(msg.simulated));

      if (msg.type === 'host-ready') {
        settled = true;
        console.info('[Decode It][ui] Received host-ready', { host: msg.host, simulated: isSim });
        setSimulated(isSim);
        setHost('figma');
        return;
      }
      if (msg.type === 'host-off') {
        if (!fromSameWindow) return;
        lastSeq.current = -1;
        setUrl(null);
        setSimulated(false);
        setSelection({ kind: 'none' });
        setHost('none');
        return;
      }
      if (msg.seq < lastSeq.current) return; // an older answer arriving late
      lastSeq.current = msg.seq;
      settled = true;
      setSimulated(isSim);
      setHost('figma');
      const s = msg.state;
      console.info('[Decode It][ui] Received selection message', {
        seq: msg.seq,
        kind: s.kind,
        ...(s.kind === 'frame' || s.kind === 'loading' ? { id: s.id, nodeType: s.nodeType, width: s.width, height: s.height } : {}),
      });
      if (s.kind === 'frame') {
        const bytes = toUint8Array(s.image);
        const blob = new Blob([bytes as BlobPart], { type: 'image/png' });
        const previewUrl = URL.createObjectURL(blob);
        setUrl(previewUrl);
        setSelection({
          kind: 'frame',
          id: s.id,
          name: s.name,
          nodeType: s.nodeType,
          width: s.width,
          height: s.height,
          imageWidth: s.imageWidth,
          imageHeight: s.imageHeight,
          blob,
          previewUrl,
        });
        setSelectionVersion((v) => v + 1);
      } else {
        setUrl(null);
        setSelection(s);
        setSelectionVersion((v) => v + 1);
      }
    };
    window.addEventListener('message', onMessage);
    sendToPlugin({ type: 'ui-ready' });
    const retry1 = setTimeout(() => {
      if (!settled) sendToPlugin({ type: 'ui-ready' });
    }, 120);
    const retry2 = setTimeout(() => {
      if (!settled) sendToPlugin({ type: 'ui-ready' });
    }, 350);
    const t = setTimeout(() => setHost((h) => (h === 'pending' ? 'none' : h)), HANDSHAKE_MS);
    return () => {
      clearTimeout(retry1);
      clearTimeout(retry2);
      clearTimeout(t);
      window.removeEventListener('message', onMessage);
      setUrl(null);
    };
  }, []);

  const refresh = useCallback(() => sendToPlugin({ type: 'refresh-selection' }), []);
  return { host, simulated, selection, selectionVersion, refresh };
}
