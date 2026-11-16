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

## Model

`gemini-3.5-flash-lite` (stable, image input, structured output, free tier per Google's pricing page, no shutdown
announced). Verified against Google's docs on 2026-11-13. Free-tier RPM/RPD are account-specific; check
https://aistudio.google.com/rate-limit. Change the model with the `GEMINI_MODEL` var in `wrangler.jsonc`.
Free-tier prompts may be used by Google to improve its products; do not send confidential designs on the free tier.

## Security

- `GEMINI_API_KEY` is a Worker secret. It is not in `wrangler.jsonc`, the repo, or the plugin bundle.
- Origin allowlist (`ALLOWED_ORIGINS`, default `null`, which is what Figma plugin iframes send), per-IP rate limit
  (10/min), body and image size caps, strict input validation, and model output re-validated before it is returned.
- Feedback and notes are passed to the model as quoted data with an instruction to ignore embedded instructions.
- Logs record status codes only, never feedback, images or keys.
- Caveat: the Origin check stops other websites from calling it from a browser; it does not stop scripts. The rate
  limit is the real guard. If abuse appears, add Cloudflare WAF rules or a per-user token.

## Local development

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars     # put a key from https://aistudio.google.com/apikey in it
npm run dev                        # http://localhost:8787
npm run typecheck && npm test
```

## Cloudflare deployment settings

Option A: Workers Builds (connect the Git repo in Workers & Pages → Create → Import a repository)

| Setting | Value |
|---|---|
| Project / Worker name | `decode-it-worker` (must match `name` in `wrangler.jsonc`) |
| Production branch | `main` |
| **Root directory** | `worker` |
| **Build command** | `npm run typecheck` |
| **Deploy command** | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler versions upload` |
| Build variables | none needed |

Set the secret **after** the first deploy, under Worker → Settings → Variables and Secrets → Add → type **Secret**,
name `GEMINI_API_KEY`. (Not under "Build" variables: those are not available at runtime.)

Option B: from your terminal

```bash
cd worker
npx wrangler login
npx wrangler secret put GEMINI_API_KEY    # paste the key when prompted
npm run deploy
```

Then check `https://decode-it-worker.<your-subdomain>.workers.dev/health`.

## Wiring the plugin (not done yet)

1. Add a `workerProvider` implementing `DecodeProvider` (src/lib/decoder.ts) that POSTs to the Worker, then point
   `src/lib/active.ts` at it. The demo provider stays as a fallback.
2. In `plugin/manifest.json` change `networkAccess.allowedDomains` from `["none"]` to the Worker URL and update the
   `reasoning`. Update `plugin/README.md`, which currently says the plugin makes no network requests.
3. `scripts/check-plugin.mts` may assert `networkAccess: none`; update it with step 2.
