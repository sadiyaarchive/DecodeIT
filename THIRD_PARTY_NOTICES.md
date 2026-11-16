# Third-party notices

Decode It is released under the [MIT License](LICENSE). It includes or builds on the following
third-party software. Each keeps its own licence.

## Bundled into the plugin (`dist-plugin/ui.html`)

| Component | Version | Licence | Source |
|---|---|---|---|
| React, React DOM | 19.2 | MIT | https://github.com/facebook/react |
| lucide-react (icons) | 1.59 | ISC (parts derived from Feather, MIT) | https://github.com/lucide-icons/lucide |
| Geist, Latin subset (font) | variable, 400-600 | SIL Open Font License 1.1 | https://github.com/vercel/geist-font |

The Geist font is embedded in the plugin UI as a base64 data URI. Its copyright notice and licence
text are in [`src/assets/fonts/OFL.txt`](src/assets/fonts/OFL.txt) and must travel with any copy
of the font. Under the OFL the font may not be sold by itself.

## Build, test and deploy tooling (not shipped to users)

| Component | Licence |
|---|---|
| Vite, @vitejs/plugin-react, Tailwind CSS, @tailwindcss/vite | MIT |
| TypeScript | Apache-2.0 |
| @figma/plugin-typings | MIT |
| oxfmt | MIT |
| Wrangler, @cloudflare/workers-types (Worker) | MIT OR Apache-2.0 |

Exact versions are pinned in `pnpm-lock.yaml` (app) and `worker/package-lock.json` (Worker). The
Worker has no runtime dependencies.

## Services (not software we distribute)

Decode It's optional live mode calls the Google Gemini API through a Cloudflare Worker. Use of
those services is governed by Google's and Cloudflare's own terms. See [PRIVACY.md](PRIVACY.md).

## Trademarks

"Figma" is a trademark of Figma, Inc. "Gemini" and "Google" are trademarks of Google LLC.
"Cloudflare" is a trademark of Cloudflare, Inc. Decode It is an independent project and is not
affiliated with or endorsed by any of them.
