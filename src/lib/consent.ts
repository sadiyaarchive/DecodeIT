import { useCallback, useEffect, useState } from 'react';
import { sendToPlugin } from './figma/host.ts';
import { isPluginToUi } from './figma/protocol.ts';

// Whether the person has agreed to send designs to the Worker and Gemini. Inside Figma it is kept in
// figma.clientStorage (via the plugin code), which survives restarts. Elsewhere, and if Figma does
// not answer, it falls back to localStorage, and to memory when even that is blocked.

const LS_KEY = 'decode-it-consent-v1';
const WAIT_MS = 700;

const readLocal = (): boolean => {
  try {
    return localStorage.getItem(LS_KEY) === '1';
  } catch {
    return false;
  }
};
const writeLocal = (v: boolean) => {
  try {
    if (v) localStorage.setItem(LS_KEY, '1');
    else localStorage.removeItem(LS_KEY);
  } catch {
    /* blocked: consent then lasts for this session only */
  }
};

/** `accepted` is null until we know. Treat null like "not yet agreed". */
export function useConsent() {
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    let answered = false;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== parent || e.source === window) return; // only the Figma plugin code may answer
      const msg = e.data?.pluginMessage;
      if (!isPluginToUi(msg) || msg.type !== 'consent') return;
      answered = true;
      setAccepted(msg.accepted || readLocal());
    };
    window.addEventListener('message', onMessage);
    sendToPlugin({ type: 'get-consent' });
    const t = setTimeout(() => {
      if (!answered) setAccepted(readLocal());
    }, WAIT_MS);
    return () => {
      clearTimeout(t);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  const grant = useCallback(() => {
    setAccepted(true);
    writeLocal(true);
    sendToPlugin({ type: 'set-consent', accepted: true });
  }, []);

  return { accepted, grant };
}
