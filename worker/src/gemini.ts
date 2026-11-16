import { buildUserText, RESPONSE_SCHEMA, SYSTEM_INSTRUCTION } from './prompt.ts';
import { sanitizeOutput } from './validate.ts';
import type { DecodeBody, DecodeOutput, Env } from './types.ts';

export class UpstreamError extends Error {
  constructor(public status: number, public code: 'rate_limit' | 'upstream' | 'bad_output', message: string) {
    super(message);
  }
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function callGemini(env: Env, body: DecodeBody, signal: AbortSignal): Promise<DecodeOutput> {
  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
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
    }),
  });

  if (res.status === 429) throw new UpstreamError(429, 'rate_limit', 'Gemini quota reached.');
  if (!res.ok) {
    // Log status only. Never log the key or the user's design/feedback.
    console.error('gemini_error', res.status);
    throw new UpstreamError(502, 'upstream', `Gemini returned ${res.status}.`);
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new UpstreamError(502, 'bad_output', 'Model returned invalid JSON.');
  }
  const out = sanitizeOutput(parsed);
  if (!out) throw new UpstreamError(502, 'bad_output', 'Model output did not match the expected shape.');
  return out;
}
