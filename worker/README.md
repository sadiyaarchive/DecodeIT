# Decode It: AI backend (Cloudflare Worker)

A small Worker that receives design feedback plus the selected design, asks Gemini to interpret it, and returns
structured JSON. The Gemini key lives only here, as a Cloudflare secret. The Figma plugin never sees it.

```
Figma plugin UI  --POST /v1/decode-->  Worker  --x-goog-api-key-->  Gemini (gemini-3.5-flash-lite)
 (no key)         <--JSON readings--   (secret)  <--JSON-----------
```

## API

`POST /v1/decode` (JSON). `GET /health` returns `{ok, model}`.

```jsonc
{
  "comment": "Can we make this feel more premium?",          // required, <= 1000 chars
  "design": {                                                  // required
    "kind": "figma-frame",                                     // or "screenshot"
    "name": "Home", "width": 390, "height": 844,
    "mimeType": "image/png",                                   // png | jpeg | webp
    "imageBase64": "<base64, no data: prefix, <= 4 MB decoded>"
  },
  "context": { "description": "", "audience": "", "goal": "", "layerSummary": "" }   // all optional
}
```

Success (200): `{ summary, interpretations[{label, meaning, issues[], tries[], why}], questions[], assumptions[], model }`.
Errors: `{ error: { code, message } }` with 400 invalid_input, 403 forbidden_origin, 413 too_large, 415, 429 rate_limit,
502 upstream/bad_output, 504 timeout. The plugin should map these onto its existing `DecodeError` kinds.

## Model and operations

The repository currently configures `gemini-3.5-flash-lite` in `wrangler.jsonc`. Keep the existing integration;
verify the deployed model, account plan, quotas and applicable data terms before release.

The [maintainer operations guide](../docs/OPERATIONS.md) covers local development, key handling, rate limiting,
observability, emergency shutdown and deployment. Designers do not need any of these steps.

## Local checks

```bash
cd worker
npm ci
npm run typecheck
npm test
npm run build            # bundle dry run; does not deploy
```

Maintainer commands remain available: `npm run dev`, `npm run deploy`, `npm run secret:gemini` and `npm run tail`.
Deployment, secret changes and live tailing require the appropriate account access and operator approval.
Do not paste secrets or request logs into issues or chat.

## Plugin integration

- `src/lib/worker-provider.ts` sends live requests to the fixed official endpoint.
- `src/lib/worker-url.ts` supplies that endpoint and the manifest disclosure; users cannot configure another URL.
- `src/lib/active.ts` selects live Gemini-backed decoding or offline Demo mode.
- The production allowlist stays `ALLOWED_ORIGINS=null`. Browser preview work uses Demo mode.
- No separate plugin UI hosting is needed: the built `ui.html` is bundled into the Figma plugin.
