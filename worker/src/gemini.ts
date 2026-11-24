import { buildUserText, RESPONSE_SCHEMA, SYSTEM_INSTRUCTION } from './prompt.ts';
import { sanitizeOutput } from './validate.ts';
import type { DecodeBody, DecodeOutput, Env } from './types.ts';

export class UpstreamError extends Error {
  readonly status: number;
  readonly code: 'rate_limit' | 'upstream' | 'bad_output';
  readonly upstreamStatus: number;
  readonly category: string;

  constructor(status: number, code: UpstreamError['code'], message: string, upstreamStatus: number, category: string = code) {
    super(message);
    this.status = status;
    this.code = code;
    this.upstreamStatus = upstreamStatus;
    this.category = category;
  }
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Only known enum values may reach logs; never echo arbitrary upstream strings.
const FINISH_REASONS = new Set([
  'FINISH_REASON_UNSPECIFIED', 'STOP', 'MAX_TOKENS', 'SAFETY', 'RECITATION', 'LANGUAGE',
  'OTHER', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'MALFORMED_FUNCTION_CALL',
  'IMAGE_SAFETY', 'IMAGE_PROHIBITED_CONTENT', 'IMAGE_OTHER', 'NO_IMAGE', 'IMAGE_RECITATION',
  'UNEXPECTED_TOOL_CALL', 'TOO_MANY_TOOL_CALLS', 'MISSING_THOUGHT_SIGNATURE',
]);
const BLOCK_REASONS = new Set(['BLOCK_REASON_UNSPECIFIED', 'SAFETY', 'OTHER', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'IMAGE_SAFETY']);
const safeReason = (value: unknown, allowed: Set<string>) =>
  typeof value === 'string' && value ? (allowed.has(value) ? value : 'UNKNOWN') : undefined;
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function checkDeadline(signal: AbortSignal, deadline: number): void {
  signal.throwIfAborted();
  if (Date.now() >= deadline) throw new DOMException('Gemini deadline exhausted.', 'TimeoutError');
}

function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function retryDelay(header: string | null): number {
  const backoff = 1000 + Math.floor(Math.random() * 250);
  if (!header) return backoff;
  const value = header.trim();
  const requested = /^\d+$/.test(value) ? Number(value) * 1000 :
    /[a-z]/i.test(value) ? Date.parse(value) - Date.now() : NaN;
  return Number.isNaN(requested) ? backoff : Math.max(backoff, requested);
}

export async function callGemini(env: Env, body: DecodeBody, signal: AbortSignal, deadline: number): Promise<DecodeOutput> {
  const started = Date.now();
  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: body.design.mimeType, data: body.design.imageBase64 } },
          { text: buildUserText(body) },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 2048,
    },
  });

  for (let attempt = 1; attempt <= 2; attempt++) {
    let res: Response | undefined;
    let finishReason: string | undefined;
    let blockReason: string | undefined;
    const logFailure = (error: unknown) => console.error('gemini_error', {
      ...(res ? { upstreamStatus: res.status } : {}),
      attempt,
      elapsedMs: Date.now() - started,
      category: error instanceof UpstreamError ? error.category :
        signal.aborted || (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) ? 'timeout' : 'network',
      ...(finishReason ? { finishReason } : {}),
      ...(blockReason ? { blockReason } : {}),
    });
    try {
      checkDeadline(signal, deadline);
      res = await fetch(`${ENDPOINT}/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`, {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: requestBody,
      });
      checkDeadline(signal, deadline);
      if (!res.ok) {
        // Discard error bodies without reading or logging potentially sensitive content.
        void res.body?.cancel().catch(() => {});
        if (res.status === 429) throw new UpstreamError(429, 'rate_limit', 'Gemini quota reached.', res.status);
        throw new UpstreamError(502, 'upstream', 'Gemini request failed.', res.status);
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch (error) {
        checkDeadline(signal, deadline);
        if (!(error instanceof SyntaxError)) throw error;
        throw new UpstreamError(502, 'bad_output', 'Gemini returned invalid JSON.', res.status, 'invalid_response');
      }
      checkDeadline(signal, deadline);
      const candidate = isObject(data) && Array.isArray(data.candidates) ? data.candidates[0] : undefined;
      finishReason = safeReason(isObject(candidate) ? candidate.finishReason : undefined, FINISH_REASONS);
      blockReason = safeReason(isObject(data) && isObject(data.promptFeedback) ? data.promptFeedback.blockReason : undefined, BLOCK_REASONS);
      const badOutput = (category: string) => new UpstreamError(502, 'bad_output', 'Model output was unusable.', res!.status, category);
      if (blockReason && blockReason !== 'BLOCK_REASON_UNSPECIFIED') throw badOutput('blocked_output');
      if (finishReason && finishReason !== 'STOP') throw badOutput('incomplete_output');
      const parts = isObject(candidate) && isObject(candidate.content) ? candidate.content.parts : undefined;
      const text = Array.isArray(parts) ? parts.map((p) => isObject(p) && typeof p.text === 'string' ? p.text : '').join('') : '';
      if (!text.trim()) throw badOutput('missing_output');
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw badOutput('invalid_json');
      }
      const out = sanitizeOutput(parsed);
      if (!out) throw badOutput('invalid_shape');
      return out;
    } catch (error) {
      logFailure(error);
      // Retry only the first HTTP 503, never a transport failure or unusable model output.
      if (!(error instanceof UpstreamError) || error.upstreamStatus !== 503 || attempt !== 1) throw error;
      const delay = retryDelay(res!.headers.get('retry-after'));
      // Do not violate Retry-After or extend the original deadline to squeeze in another call.
      if (Date.now() + delay >= deadline) throw error;
      try {
        await waitForRetry(delay, signal);
        checkDeadline(signal, deadline);
      } catch (error) {
        logFailure(error);
        throw error;
      }
    }
  }
  throw new Error('Gemini attempts exhausted.');
}
