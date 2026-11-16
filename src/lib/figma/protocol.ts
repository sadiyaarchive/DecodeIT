// Messages between the plugin code (runs inside Figma, can see the document) and the plugin UI
// (an iframe, can show things but cannot see the document). Keep this file free of imports so
// both sides can use it.

export const PROTOCOL_VERSION = 1;

/** From the UI to the plugin. */
export type UiToPlugin =
  | { type: 'ui-ready' }
  | { type: 'refresh-selection' }
  | { type: 'notify'; text: string };

/** What the plugin tells the UI about the user's selection on the canvas. */
export type SelectionState =
  | { kind: 'none' }
  | { kind: 'multiple'; count: number }
  | { kind: 'unsupported'; nodeType: string; name: string }
  | { kind: 'loading'; id: string; name: string; nodeType: string; width: number; height: number }
  | {
      kind: 'frame';
      id: string;
      name: string;
      nodeType: string;
      /** Size of the layer in Figma, in px. */
      width: number;
      height: number;
      /** A PNG of the layer, scaled down to a sensible size. */
      image: Uint8Array;
      imageWidth: number;
      imageHeight: number;
    }
  | { kind: 'error'; name?: string; message: string };

/** From the plugin to the UI. */
export type PluginToUi =
  | { type: 'host-ready'; host: 'figma'; protocol: number; simulated?: boolean }
  | { type: 'host-off' }
  | { type: 'selection'; seq: number; state: SelectionState };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Checks whether `v` is binary image data (Uint8Array, ArrayBuffer, or numeric array across iframe/VM boundaries). */
export function isImageBytes(v: unknown): boolean {
  if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer) return true;
  if (Array.isArray(v)) return v.length > 0 && typeof v[0] === 'number';
  if (isObject(v) && isNumber(v.byteLength)) return true;
  return false;
}

/** Normalises binary image data arriving over postMessage into a standard Uint8Array. */
export function toUint8Array(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return v;
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (Array.isArray(v)) return new Uint8Array(v);
  if (isObject(v) && isNumber(v.byteLength)) {
    const len = v.byteLength;
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      const byte = (v as Record<number, unknown>)[i];
      if (typeof byte === 'number') out[i] = byte;
    }
    return out;
  }
  return new Uint8Array(0);
}

/** Checks a message that arrived over postMessage. Anything that is not exactly one of ours is ignored. */
export function isPluginToUi(v: unknown): v is PluginToUi {
  if (!isObject(v)) return false;
  if (v.type === 'host-ready') {
    return v.host === 'figma' && isNumber(v.protocol) && (v.simulated === undefined || typeof v.simulated === 'boolean');
  }
  if (v.type === 'host-off') return true;
  if (v.type !== 'selection' || !isNumber(v.seq) || !isObject(v.state)) return false;
  const s = v.state;
  switch (s.kind) {
    case 'none':
      return true;
    case 'multiple':
      return isNumber(s.count);
    case 'unsupported':
      return isString(s.nodeType) && isString(s.name);
    case 'loading':
      return isString(s.id) && isString(s.name) && isString(s.nodeType) && isNumber(s.width) && isNumber(s.height);
    case 'frame':
      return (
        isString(s.id) && isString(s.name) && isString(s.nodeType) && isNumber(s.width) && isNumber(s.height) &&
        isImageBytes(s.image) && isNumber(s.imageWidth) && isNumber(s.imageHeight)
      );
    case 'error':
      return isString(s.message) && (s.name === undefined || isString(s.name));
    default:
      return false;
  }
}

export function isUiToPlugin(v: unknown): v is UiToPlugin {
  if (!isObject(v)) return false;
  if (v.type === 'ui-ready' || v.type === 'refresh-selection') return true;
  return v.type === 'notify' && isString(v.text);
}
