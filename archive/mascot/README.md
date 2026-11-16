# Archived mascot art (not part of the app)

Approved static cat art, set aside while the product experience is improved.
Nothing in `src/` imports it, and `tsconfig.json` only includes `src/`.

- `CatPoses.tsx`: shared head, five poses, flat yarn, header icon (static, no animation)
- `mascot-gallery.tsx` and `mascot-gallery.html`: review page for the five poses

To view it again, move `CatPoses.tsx` to `src/components/`, `mascot-gallery.tsx` to `src/`
and `mascot-gallery.html` to the project root, then open `/mascot-gallery.html` on the dev server.
Palette used in the art: black `#111111`, white eyes, rose-pink yarn from the earlier palette
(this is not the current purple palette).
