# Brand assets

| File | What it is |
|---|---|
| `DecodeIT-logo.svg` | The Decode It logo, added by the project owner exactly as supplied (657 x 427, a gradient speech-bubble cat with a `</>` mark). **Do not edit, recolour or redraw it.** |

Where it is used:

- the top of the root [`README.md`](../../README.md)
- the dev page's favicon, referenced from [`index.html`](../../index.html) at this path (Vite bundles it into `dist/`, so there is a single copy)

Not used (by design): the Figma plugin panel itself shows the text title "Decode It", and Figma plugin manifests
take their icon from the Figma Community listing, not from this repository.

Notes for reuse:

- The artwork has a very dark top edge, so on dark backgrounds the ears blend in; place it on a light surface or add padding.
- The SVG is not square, so browsers letterbox it as a favicon. Replacing it with a square variant is a design decision for the owner.
- Licence and attribution for the logo are not stated yet. *(Owner decision: state in this file whether the logo is covered by the repository's MIT licence or reserved. See "Remaining decisions" in the cleanup report.)*
- The unused cat illustrations in [`archive/mascot/`](../../archive/mascot/) are a different, older artwork and must not be confused with this logo.
