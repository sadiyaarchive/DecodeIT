# Decode It: notes for contributors and coding agents

Decode It is a Figma plugin (React + Vite + Tailwind CSS v4) plus a small Cloudflare Worker that calls Google Gemini.
Read [CONTRIBUTING.md](CONTRIBUTING.md) first; this file is the quick map.

## Where things are

- `plugin/code.ts`: Figma plugin code (runs in Figma's sandbox: selection, PNG export, `clientStorage`). `plugin/manifest.json` is the source manifest.
- `src/`: plugin UI. `src/App.tsx` is the screen; `src/lib/` holds the logic: `decoder.ts` (types, demo provider), `worker-provider.ts` (live provider), `active.ts` (picks one), `worker-url.ts` (`DECODEIT_WORKER_URL`), `run.ts` (timeouts, cancel, error copy), `figma/` (host protocol).
- `worker/`: Cloudflare Worker (own `package.json`, tests, README). `worker/src/types.ts` + `validate.ts` define the API contract.
- `scripts/`: `build-plugin.mjs` and dependency-free `check-*.mts` scripts.
- `docs/SELF_HOSTING.md`, `PRIVACY.md`, `SECURITY.md`: keep them true when behaviour changes.

## Commands

`pnpm run typecheck`, `pnpm run check`, `pnpm run build`, `pnpm run build:plugin`; Worker: `cd worker && npm run typecheck && npm test`.

## Rules that matter

- **No secrets in the client or repo.** The Gemini key is a Worker secret only. No shared tokens in the plugin.
- **The plugin may contact only the Worker.** `networkAccess` is derived from `DECODEIT_WORKER_URL` by the build; do not hand-edit the built manifest.
- **Do not weaken Worker validation, origin checks or rate limiting** for convenience. Use `worker/.dev.vars` locally.
- **Honest output:** readings are guesses; demo output stays labelled as demo.
- **Privacy changes** need the in-plugin notice, `PRIVACY.md` and the manifest reasoning updated together.

## Code style

- Tailwind v4 via `@tailwindcss/vite`: no Tailwind or PostCSS config file. Global CSS and font wiring live in `src/index.css`.
- Use double quotes for strings containing apostrophes. TypeScript is strict.
