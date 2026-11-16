// The live provider: sends the design image, the feedback and the optional notes to the Decode It
// Cloudflare Worker, which asks Google Gemini and returns structured readings. The Gemini API key
// exists only as a Worker secret. Nothing in this file or in the plugin bundle can see it.
//
// Contract: worker/src/types.ts (DecodeBody) and worker/README.md. Keep them in step.

import { assertValidRequest, gatherContext } from './context.ts';
import { DecodeError } from './decoder.ts';
import type { DecodeErrorKind, DecodeProvider, DecodeRequest, DecodeResult, DecodeSource, Interpretation } from './decoder.ts';
import { ACCEPTED_IMAGE_TYPES, formatMb, MAX_IMAGE_BYTES } from './design.ts';

import { DEFAULT_WORKER_URL } from './worker-url.ts';

export { DEFAULT_WORKER_URL };

const LIVE_SOURCE: DecodeSource = {
  id: 'gemini',
  label: 'Gemini, via the Decode It Worker',
  isDemo: false,
};

/** Worker error codes (worker/src/index.ts) mapped onto the kinds the UI already has copy for. */
const CODE_TO_KIND: Record<string, DecodeErrorKind> = {
  invalid_input: 'input',
  too_large: 'image',
  rate_limit: 'rate_limit',
  timeout: 'timeout',
};

/** Shape of a successful Worker response. */
interface WorkerOutput {
  summary: string;
  interpretations: Interpretation[];
  questions: string[];
  assumptions: string[];
  model?: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** The Worker validates and sanitises model output; this guards against anything else answering. */
function parseOutput(v: unknown): WorkerOutput | null {
  if (!isObj(v) || typeof v.summary !== 'string' || !Array.isArray(v.interpretations) || v.interpretations.length === 0) return null;
  if (!isStrings(v.questions) || !isStrings(v.assumptions)) return null;
  const ok = v.interpretations.every(
    (r) => isObj(r) && typeof r.label === 'string' && typeof r.meaning === 'string' && typeof r.why === 'string' && isStrings(r.issues) && isStrings(r.tries),
  );
  return ok ? (v as unknown as WorkerOutput) : null;
}

/** Base64 of a blob with no `data:` prefix (the Worker rejects one). Chunked so large images do not overflow the call stack. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

/** Checks the image the Worker would reject, before spending a request on it. Throws an `image` or `input` error. */
export function assertImageAllowed(image: Blob): void {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(image.type)) {
    throw new DecodeError("That image type isn't supported. Use a PNG, JPG or WebP image.", 'input');
  }
  if (image.size > MAX_IMAGE_BYTES) {
    throw new DecodeError(
      `The design image is ${formatMb(image.size)}. The limit is ${formatMb(MAX_IMAGE_BYTES)}. Select a smaller frame, or upload a smaller screenshot.`,
      'image',
    );
  }
}

function kindForStatus(status: number): DecodeErrorKind {
  if (status === 429) return 'rate_limit';
  if (status === 504) return 'timeout';
  if (status === 413) return 'image';
  return 'server';
}

export interface WorkerProviderOptions {
  /** Base URL of the Worker, no trailing slash needed. */
  url: string;
  /** Injected in tests. */
  fetch?: typeof fetch;
}

export function createWorkerProvider(options: WorkerProviderOptions): DecodeProvider {
  const base = options.url.replace(/\/+$/, '');
  const doFetch = options.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));

  return {
    ...LIVE_SOURCE,
    async decode(req: DecodeRequest, opts): Promise<DecodeResult> {
      if (opts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const feedback = assertValidRequest(req);
      assertImageAllowed(req.design.image);

      const body = {
        comment: feedback,
        design: {
          kind: req.design.kind,
          name: req.design.name,
          width: req.design.width,
          height: req.design.height,
          mimeType: req.design.image.type,
          imageBase64: await blobToBase64(req.design.image),
        },
        context: {
          description: req.context.description.trim(),
          audience: req.context.audience.trim(),
          goal: req.context.goal.trim(),
          layerSummary: req.context.layerSummary ?? '',
        },
      };

      let res: Response;
      try {
        res = await doFetch(`${base}/v1/decode`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: opts?.signal,
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e;
        throw new DecodeError('Could not reach the Worker.', 'network');
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        data = undefined;
      }

      if (!res.ok) {
        const err = isObj(data) && isObj(data.error) ? data.error : {};
        const code = typeof err.code === 'string' ? err.code : '';
        const message = typeof err.message === 'string' ? err.message : `The decoder answered ${res.status}.`;
        const kind = CODE_TO_KIND[code] ?? kindForStatus(res.status);
        // Only `input` and `image` messages are shown to people; the Worker writes those for users.
        throw new DecodeError(message, kind);
      }

      const out = parseOutput(data);
      if (!out) throw new DecodeError('The decoder returned an unexpected response.', 'server');

      const { observed, provided, missingContext } = gatherContext(req);
      return {
        source: out.model ? { ...LIVE_SOURCE, label: `${out.model}, via the Decode It Worker` } : LIVE_SOURCE,
        scenario: 'live',
        summary: out.summary,
        interpretations: out.interpretations,
        questions: out.questions,
        observed,
        assumptions: out.assumptions,
        missingContext,
        // Everything provided was sent to the model, so all of it counts as used.
        contextUse: {
          provided,
          used: provided,
          note: 'Your design image, feedback and notes were sent to Google Gemini to write these readings. They are AI-generated guesses and can be wrong.',
        },
      };
    },
  };
}
