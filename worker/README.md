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
| Project / Worker name | `decodeit` (must match `name` in `wrangler.jsonc`) |
| Production branch | `main` |
| **Root directory** | `worker` |
| **Build command** | `npm run typecheck` |
| **Deploy command** | `npx wrangler deploy` |
| Non-production branch builds | **Disabled** (see the warning below) |
| Build variables | none needed |

> **Warning: do not build pull requests or feature branches with Workers Builds.** A preview version of a Worker runs
> with the Worker's runtime secrets, so a malicious pull request could ship code that reads `GEMINI_API_KEY`. Keep
> non-production branch builds off, and review code before it reaches `main`. GitHub Actions CI in this repo never
> has access to the key and does not deploy.

Set the secret **after** the first deploy, under Worker → Settings → Variables and Secrets → Add → type **Secret**,
name `GEMINI_API_KEY`. (Not under "Build" variables: those are not available at runtime.)

Option B: from your terminal

```bash
cd worker
npx wrangler login
npx wrangler secret put GEMINI_API_KEY    # paste the key when prompted
npm run deploy
```

Then check `https://decodeit.sadiya-archives.workers.dev/health`.

## Wiring the plugin

- `src/lib/worker-provider.ts` is the client for this API; `src/lib/active.ts` selects it (live) or the demo.
- The plugin build takes the Worker URL from `DECODEIT_WORKER_URL` (default: the hosted Worker, `src/lib/worker-url.ts`)
  and derives `networkAccess` in the built manifest from it. See [../docs/SELF_HOSTING.md](../docs/SELF_HOSTING.md).
- For browser-tab testing add the dev origin in `.dev.vars` (`ALLOWED_ORIGINS=null,http://localhost:8443`), never in `wrangler.jsonc`.
