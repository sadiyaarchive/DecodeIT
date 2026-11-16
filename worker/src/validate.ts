import type { DecodeBody, DecodeOutput } from './types.ts';

export const MAX_COMMENT = 1000;
const MAX_NOTE = 500;
const MIMES = ['image/png', 'image/jpeg', 'image/webp'];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export type Parsed = { ok: true; body: DecodeBody } | { ok: false; error: string };

export function parseBody(raw: unknown, maxImageBytes: number): Parsed {
  if (!isObj(raw)) return { ok: false, error: 'Body must be a JSON object.' };
  const comment = str(raw.comment, MAX_COMMENT + 1);
  if (!/[a-z]{2,}/i.test(comment)) return { ok: false, error: 'Feedback is missing or not readable text.' };
  if (comment.length > MAX_COMMENT) return { ok: false, error: `Feedback is longer than ${MAX_COMMENT} characters.` };

  const d = raw.design;
  if (!isObj(d)) return { ok: false, error: 'design is required.' };
  if (!MIMES.includes(d.mimeType as string)) return { ok: false, error: 'design.mimeType must be PNG, JPEG or WebP.' };
  const b64 = typeof d.imageBase64 === 'string' ? d.imageBase64 : '';
  if (!b64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { ok: false, error: 'design.imageBase64 must be base64 without a data: prefix.' };
  if (Math.floor((b64.length * 3) / 4) > maxImageBytes) return { ok: false, error: 'Image is too large.' };

  const ctx = isObj(raw.context) ? raw.context : {};
  return {
    ok: true,
    body: {
      comment,
      design: {
        kind: d.kind === 'screenshot' ? 'screenshot' : 'figma-frame',
        name: str(d.name, 120),
        width: Number.isFinite(d.width) ? Number(d.width) : 0,
        height: Number.isFinite(d.height) ? Number(d.height) : 0,
        mimeType: d.mimeType as DecodeBody['design']['mimeType'],
        imageBase64: b64,
      },
      context: {
        description: str(ctx.description, MAX_NOTE),
        audience: str(ctx.audience, MAX_NOTE),
        goal: str(ctx.goal, MAX_NOTE),
        layerSummary: str(ctx.layerSummary, 2000),
      },
    },
  };
}

const strings = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()).slice(0, max) : [];

/** Never trust model JSON: coerce to the shape the plugin expects, or return null. */
export function sanitizeOutput(v: unknown): DecodeOutput | null {
  if (!isObj(v) || typeof v.summary !== 'string' || !Array.isArray(v.interpretations)) return null;
  const interpretations = v.interpretations
    .filter(isObj)
    .map((r) => ({
      label: str(r.label, 80),
      meaning: str(r.meaning, 500),
      issues: strings(r.issues, 4),
      tries: strings(r.tries, 4),
      why: str(r.why, 400),
    }))
    .filter((r) => r.label && r.meaning)
    .slice(0, 3);
  if (interpretations.length === 0) return null;
  return {
    summary: str(v.summary, 400),
    interpretations,
    questions: strings(v.questions, 4),
    assumptions: strings(v.assumptions, 4),
  };
}
