# Decode It

**Read between the lines of design feedback.** Decode It is a Figma plugin that takes a vague comment like
*"Can we make this feel more premium?"* together with the frame it is about, and returns two or three plausible
readings of what the reviewer might mean, specific things to check, and questions to ask them. Every reading is
labelled as a guess, never a fact.

<p align="center">
  <img src="assets/screenshots/compose.png" alt="Decode It plugin with a pricing-page frame selected and feedback typed in" width="300">
  &nbsp;&nbsp;
  <img src="assets/screenshots/result-demo.png" alt="Decode It showing demo-mode readings for the feedback 'make this feel more premium'" width="300">
</p>
<p align="center"><sub>Left: a frame selected in Figma, feedback pasted. Right: the result in demo mode (built-in samples, nothing sent anywhere).</sub></p>

## Features

- Reads the **selected Figma frame** (or an uploaded or pasted screenshot) together with the feedback.
- Two or three **possible readings**, each with what to look for, concrete things to try, and why.
- **Questions to ask** the reviewer, only when the feedback is genuinely ambiguous.
- **Honest labelling**: guesses are marked as guesses, and the result says what was and was not used.
- **Demo mode**: built-in sample scenarios that work offline and send nothing anywhere.
- **Self-hostable**: the AI part is a ~300-line Cloudflare Worker you can run with your own Gemini key.
- Accessible by default: keyboard operable, screen-reader announcements, reduced-motion friendly.

## How it works

```
┌────────────────────────── Figma Desktop ──────────────────────────┐
│  plugin code (plugin/code.ts)        plugin UI (src/, React)       │
│  reads selection, exports PNG  ───►  feedback form, results        │
└───────────────────────────────────────────┬────────────────────────┘
                                            │ HTTPS POST /v1/decode
                                            │ image + feedback + notes  (no API key)
                                            ▼
                          Cloudflare Worker (worker/)  ── holds GEMINI_API_KEY (secret)
                          validates input, rate-limits, builds prompt
                                            │
                                            ▼
                                   Google Gemini API
                          returns structured JSON, re-validated by the Worker
```

- The **plugin** never contains an API key. It can contact exactly one domain, the Worker, and that domain is written
  into `manifest.json` from the same setting the UI uses.
- The **Worker** checks the request (origin, size, shape), applies a per-IP rate limit, asks Gemini for JSON that
  matches a schema, and sanitises whatever comes back before returning it.
- **Demo mode** swaps the Worker for hand-written scenarios in `src/lib/scenarios.ts`.

## Quick start

You need Node.js 22.18 or newer (24 recommended), [pnpm](https://pnpm.io) 10, and **Figma Desktop** (the web app cannot load local plugins).

```bash
git clone https://github.com/sadiyaarchive/DecodeIT.git
cd DecodeIT
pnpm install
pnpm run build:plugin     # writes dist-plugin/manifest.json, code.js, ui.html
```

In Figma Desktop: open a design file, then **Plugins → Development → Import plugin from manifest…** and choose
`dist-plugin/manifest.json`. Run it from **Plugins → Development → Decode It**.

By default the plugin uses the project's hosted Worker. That instance is best effort: it is rate limited and may be
slow, change or be switched off. **For anything beyond a trial, run your own** (about 10 minutes, free tiers are
enough): see [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

To try it without any AI and without sending anything: open *Testing the plugin? Try sample feedback* in the plugin and
tick **Demo mode**, or run `pnpm dev` and open `http://localhost:8443/?provider=demo`.

## Using your own Worker

```bash
DECODEIT_WORKER_URL=https://your-worker.your-subdomain.workers.dev pnpm run build:plugin
```

`DECODEIT_WORKER_URL` is the one setting. It decides where the UI sends requests and what `networkAccess.allowedDomains`
the built manifest contains. Unset, the hosted default is used. Full instructions, including how to deploy the Worker
with your own Gemini key, are in [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

## Privacy

In live mode the selected design image, your feedback and any notes are sent to the Worker and on to Google Gemini.
The plugin tells you this next to the button, and the first press of **Agree and decode** is your acknowledgement. Please
avoid confidential or sensitive information. Details, including what the project does and does not store, are in
[PRIVACY.md](PRIVACY.md).

## Repository layout

| Path | What it is |
|---|---|
| `plugin/` | Figma plugin code (runs in Figma's sandbox) and manifest |
| `src/` | Plugin UI (React, Tailwind CSS v4); `src/lib/` holds the decoding logic and providers |
| `worker/` | The Cloudflare Worker that calls Gemini (own `package.json`, tests and README) |
| `scripts/` | Build script for the plugin and dependency-free check scripts |
| `docs/` | Self-hosting guide |
| `assets/` | Screenshots used in the README, and `brand/` (reserved for the logo) |
| `archive/` | Unused artwork kept for reference |

## Development

```bash
pnpm dev                # UI in a browser tab, with switches that simulate Figma and failures
pnpm run typecheck      # app + plugin
pnpm run check          # logic checks (matching, scenarios, summary, states, worker provider, plugin/manifest)
pnpm run build          # UI build
pnpm run build:plugin   # the plugin bundle

cd worker && npm install && npm run typecheck && npm test
```

The dev server runs the UI in a plain browser tab, so it cannot reach the production Worker (its CORS allowlist only
admits Figma's `Origin: null`, and we deliberately do not widen it). Use demo mode there, or run the Worker locally;
see the local development section of [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

## Contributing

Issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md). To report a vulnerability, follow [SECURITY.md](SECURITY.md) rather than opening
a public issue.

## Licence

[MIT](LICENSE). Third-party components and the bundled Geist font (SIL OFL 1.1) are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Decode It is independent and not affiliated with Figma, Google or
Cloudflare.
