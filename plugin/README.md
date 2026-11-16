# Decode It: Figma plugin

Decode It helps designers read between the lines of ambiguous feedback. The plugin shows possible readings,
things to try and questions to ask. **The results are built-in demo examples. No AI is involved, and the demo
does not look at the design.** The plugin makes no network requests (`networkAccess: none`).

## Build and load it in Figma

```bash
pnpm install
pnpm run build:plugin        # writes dist-plugin/manifest.json, code.js, ui.html
```

In **Figma desktop** (the web app cannot load local plugins): open any design file, then
**Plugins → Development → Import plugin from manifest…** and choose `dist-plugin/manifest.json`.
Run it from **Plugins → Development → Decode It**. After each rebuild, close and re-run the plugin.

If Figma rejects the placeholder `id` in `plugin/manifest.json`, tell me the exact message and I will adjust it.

## What to try (and what to tell me)

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
| Paste feedback, press **Unpack feedback** | Results appear. The recap shows the frame. Wording says demo, not analysed |
| Change the selection while results are showing | The results do not change |
| Switch to the **Screenshot** tab, paste an image (Cmd/Ctrl+V) or drop one | Preview, "Added" |
| Press **Copy summary**, paste elsewhere | The text is copied. If it is not, a message says so (clipboard may be blocked in plugin windows) |
| Try the keyboard: Tab, Enter, Cmd/Ctrl+Enter, Escape while unpacking | All work |
| Close and reopen | A fresh form |

## Development without Figma

`pnpm run dev` serves the UI in a normal browser tab. Two switches at the bottom left stand in for Figma
(simulated selection states) and for failures. They exist only in the dev server and are not in the plugin build.

Checks: `pnpm run check` (logic) and `pnpm run typecheck`. Browser interaction test: see the top of
`scripts/browser-smoke.js`.
