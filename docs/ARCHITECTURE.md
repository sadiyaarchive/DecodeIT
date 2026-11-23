# Architecture

Decode It is a Figma plugin with an official hosted AI backend. GitHub holds the source and collaboration;
Cloudflare Workers runs the backend; Google Gemini provides interpretation. There is no separate UI website to host.

```text
Figma sandbox (plugin/code.ts)         Plugin UI (src/, React)
  selection -> PNG preview ---------> feedback, notes, consent, results
                                                 |
                                      HTTPS POST /v1/decode
                                                 |
                       decodeit.sadiya-archives.workers.dev
                       validation -> rate limiting -> prompt
                                                 |
                                       Google Gemini API
                                                 |
                       validated JSON <----------+
```

## Boundaries

- The plugin sandbox reads the selected design and exports a preview. It does not modify the design document.
- The UI sends an image, its name/dimensions, feedback and optional context only on a live decode after consent.
- `src/lib/worker-url.ts` supplies the fixed official URL to the provider and manifest builder. There is no user or
  environment-variable override. `plugin/manifest.json` preserves the current plugin ID until Community publishing.
- The Worker keeps the Gemini API key server-side, validates input, checks origins, applies its rate-limit binding
  when present, and validates Gemini's structured output. The client validates response shape again.
- No shared token or Gemini key is bundled with the plugin. The public endpoint and origin checks do not authenticate
  callers. See [operations](OPERATIONS.md) for the limits of the abuse controls.
- Demo mode uses built-in scenarios, makes no provider request and labels its output as demo.
- Consent is remembered locally. There is no application database or saved feedback/result history.

## Repository map

| Path | Purpose |
|---|---|
| `plugin/` | Figma sandbox code, source manifest, local import and manual test guide |
| `src/` | UI, design context, consent, providers, results and demo scenarios |
| `worker/` | Cloudflare Worker, Gemini client, validation, tests and maintainer commands |
| `scripts/` | Plugin builder, logic checks and browser smoke checks |
| `.github/` | Contribution templates and CI with no deployment credentials |
| `docs/` | Architecture, maintainer operations and release gates |
| `assets/` | Original logo and screenshots |
| `archive/mascot/` | Preserved earlier mascot artwork |

The browser build is a development/review tool. The Figma build embeds scripts, styles and fonts into `ui.html`.
Privacy disclosures live in [PRIVACY.md](../PRIVACY.md), the in-plugin notice and the manifest reasoning; update them
together when data flow changes. Operational settings and the public release checklist are maintained separately.
