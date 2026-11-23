# Decode It: Figma plugin

Decode It helps designers read between the lines of ambiguous feedback. The plugin shows possible readings,
things to try and questions to ask.

**How it works, and what leaves Figma.** When you press *Decode feedback*, the plugin sends the selected frame
as a PNG (or your uploaded screenshot), the pasted feedback and any optional notes to the Decode It Cloudflare
Worker (`https://decodeit.sadiya-archives.workers.dev`), which asks Google Gemini to interpret them. This is the
official service, and the only domain the plugin may contact (`networkAccess.allowedDomains` in the built `manifest.json`).
The endpoint is fixed; users do not configure a Worker or supply a key. A short notice under the button says
what is sent, and the first button reads *Agree and decode*: pressing it is the acknowledgement, remembered with
`figma.clientStorage`. Keyboard shortcuts never skip that first click. The Gemini API key lives only in the
Worker as a Cloudflare secret and is never in this plugin. Images over 4 MB are rejected before sending.

**Demo mode.** Open *Testing the plugin? Try sample feedback* and tick *Demo mode*. The built-in sample scenarios
are used instead, no AI is involved, and nothing is sent anywhere. In the dev server, `?provider=demo` starts in
demo mode.

## Build and load it in Figma

```bash
pnpm install
pnpm run build:plugin        # writes dist-plugin/manifest.json, code.js, ui.html
```

In **Figma desktop** (the web app cannot load local plugins): open any design file, then
**Plugins → Development → Import plugin from manifest…** and choose `dist-plugin/manifest.json`.
Run it from **Plugins → Development → Decode It**. After each rebuild, close and re-run the plugin.

The current `id` in `plugin/manifest.json` is preserved for local review. Confirm the publishing ID only when
preparing the Figma Community listing. The build does not override it.

## Manual test checklist

| Try | Expect |
|---|---|
| Open with nothing selected | "Select a frame in Figma to get started." The button is greyed and says what is missing |
| Select one frame | A preview with its name and size appears within about a second. "Selected" |
| Select a component, a section, a group | Same as a frame |
| Select a text layer or a rectangle | "That's a text layer. Select a frame, component or section instead" |
| Select several layers | "Select just one frame. 3 layers are selected" |
| Select a very large or very tall frame | A preview still appears, not too slowly |
| Change the selection while the plugin is open | The preview follows |
| Edit the frame, then press Refresh | The preview updates |
| Paste feedback, press **Decode feedback** | Results appear. The recap shows the frame. With Gemini: the button says *Agree and decode* the first time, then AI-generated readings. In demo mode the wording says demo, not analysed |
| Change the selection while results are showing | The results do not change |
| Switch to the **Screenshot** tab, paste an image (Cmd/Ctrl+V) or drop one | Preview, "Added" |
| Press **Copy summary**, paste elsewhere | The text is copied. If it is not, a message says so (clipboard may be blocked in plugin windows) |
| Try the keyboard: Tab, Enter, Cmd/Ctrl+Enter, Escape while decoding | All work |
| Close and reopen | A fresh form |

## Development without Figma

`pnpm run dev` serves the UI in a normal browser tab. Two switches at the bottom left stand in for Figma
(simulated selection states) and for failures (they apply to both live and demo mode). They exist only in the dev server and are not in the plugin build.

Checks: `pnpm run check` (logic) and `pnpm run typecheck`. Browser interaction test: see the top of
`scripts/browser-smoke.js`.

### Live integration checks

The browser preview uses Demo mode for local testing. The official Worker's origin allowlist remains restricted to
Figma (`Origin: null`); do not widen it to make the browser preview work. Maintainers can exercise the local Worker
API separately using [the operations guide](../docs/OPERATIONS.md#local-worker-development).

Before release, perform the manual checklist above in real Figma, including Tab order, first-use consent, focus after
results/errors, cancellation, clipboard and a non-sensitive live decode. Browser simulations cannot verify Figma's
sandbox or manifest network restrictions. Record results in the [release checklist](../docs/RELEASE_CHECKLIST.md).
