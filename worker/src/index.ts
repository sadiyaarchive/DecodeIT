import { callGemini, UpstreamError } from './gemini.ts';
import { parseBody } from './validate.ts';
import type { Env } from './types.ts';

const MAX_BODY_BYTES = 8_000_000; // base64 of a 4 MB image is ~5.4 MB; leave headroom
const UPSTREAM_TIMEOUT_MS = 25_000;

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('origin');
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  const ok = origin !== null && (allowed.includes(origin) || allowed.includes('*'));
  return {
    ...(ok ? { 'access-control-allow-origin': origin } : {}),
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

function json(data: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors },
  });
}
const fail = (status: number, code: string, message: string, cors: Record<string, string>) =>
  json({ error: { code, message } }, status, cors);

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname === '/health' && req.method === 'GET') return json({ ok: true, model: env.GEMINI_MODEL }, 200, cors);
    if (url.pathname !== '/v1/decode') return fail(404, 'not_found', 'Not found.', cors);
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', cors);

    // Browsers always send Origin on cross-origin POSTs; reject origins we do not know.
    const origin = req.headers.get('origin');
    if (origin !== null && !('access-control-allow-origin' in cors)) return fail(403, 'forbidden_origin', 'Origin not allowed.', cors);

    if (!env.GEMINI_API_KEY) return fail(500, 'not_configured', 'Server is not configured.', cors);
    if (!(req.headers.get('content-type') ?? '').includes('application/json')) return fail(415, 'bad_content_type', 'Send application/json.', cors);
    if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return fail(413, 'too_large', 'Request too large.', cors);

    if (env.RATE_LIMITER) {
      const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) return fail(429, 'rate_limit', 'Too many requests. Try again in a minute.', cors);
    }

    let raw: unknown;
    try {
      const text = await req.text();
      if (text.length > MAX_BODY_BYTES) return fail(413, 'too_large', 'Request too large.', cors);
      raw = JSON.parse(text);
    } catch {
      return fail(400, 'bad_json', 'Body is not valid JSON.', cors);
    }
    const parsed = parseBody(raw, Number(env.MAX_IMAGE_BYTES) || 4_000_000);
    if (!parsed.ok) return fail(400, 'invalid_input', parsed.error, cors);

    try {
      const output = await callGemini(env, parsed.body, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS));
      return json({ ...output, model: env.GEMINI_MODEL }, 200, cors);
    } catch (e) {
      if (e instanceof UpstreamError) {
        return fail(e.status, e.code, e.code === 'rate_limit' ? 'The AI service is busy. Try again shortly.' : 'The AI service could not decode that. Try again.', cors);
      }
      if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
        return fail(504, 'timeout', 'The AI service did not answer in time.', cors);
      }
      console.error('unexpected', e instanceof Error ? e.name : 'unknown');
      return fail(500, 'internal', 'Unexpected error.', cors);
    }
  },
} satisfies ExportedHandler<Env>;
