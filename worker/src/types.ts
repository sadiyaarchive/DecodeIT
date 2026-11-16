export interface Env {
  /** Secret. Set with `wrangler secret put GEMINI_API_KEY`. */
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  ALLOWED_ORIGINS: string;
  MAX_IMAGE_BYTES?: string;
  RATE_LIMITER?: { limit(opts: { key: string }): Promise<{ success: boolean }> };
}

/** Mirrors DecodeRequest in src/lib/decoder.ts, with the image sent as base64. */
export interface DecodeBody {
  comment: string;
  design: {
    kind: 'figma-frame' | 'screenshot';
    name: string;
    width: number;
    height: number;
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
    imageBase64: string;
  };
  context: { description: string; audience: string; goal: string; layerSummary: string };
}

/** What the model returns. The plugin adds `source`, `observed` and `contextUse` itself. */
export interface DecodeOutput {
  summary: string;
  interpretations: { label: string; meaning: string; issues: string[]; tries: string[]; why: string }[];
  questions: string[];
  assumptions: string[];
}
