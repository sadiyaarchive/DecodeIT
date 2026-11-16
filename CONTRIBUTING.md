# Contributing to Decode It

Thanks for helping. This is a small project; clear, focused changes are the easiest to review.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). By contributing you agree that your work is
released under the [MIT License](LICENSE). To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Before you start

- For anything bigger than a small fix, **open an issue first** so we can agree on the approach.
- Check [open issues](../../issues) for something to pick up.
- **Never commit secrets** (API keys, tokens, `.dev.vars`, `.env*`). If you think you did, tell a maintainer privately.

## Set up

```bash
pnpm install                        # app (Node 22.18+, pnpm 10)
cd worker && npm install            # Worker (separate package)
```

Try changes without any AI or Figma: `pnpm dev`, open `http://localhost:8443/?provider=demo`. The switches at the bottom
left simulate Figma selection states and failures. To test live behaviour with your own key, follow
[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md#local-development). Please use your own Gemini key and Worker; do not ask
for, or use, anyone else's.

## Checks (all must pass)

```bash
pnpm run typecheck
pnpm run check
pnpm run build
pnpm run build:plugin
cd worker && npm run typecheck && npm test
```

CI runs the same on every pull request, without secrets.

## Guidelines

- **Keep the contract in step.** The request and response shapes live in `worker/src/types.ts`,
  `worker/src/validate.ts` and `src/lib/worker-provider.ts`. Change them together and update the tests.
- **Honesty of output.** Readings are guesses, never facts. Do not make the UI claim more than the provider did
  (see `contextUse`). Demo output must stay clearly labelled as demo.
- **Privacy changes need disclosure.** If you change what is sent, where, or what is stored, update the in-plugin notice,
  `PRIVACY.md` and the manifest `reasoning` text in the same pull request, and say so in the description.
- **Network access.** The plugin may contact only the Worker. Do not add other domains. `networkAccess` is derived from
  `DECODEIT_WORKER_URL` by the build; do not hand-edit the built manifest.
- **No new secrets in the client.** No keys, no shared tokens, nothing in `DECODEIT_*` that is not a public URL.
- **Do not weaken the Worker's validation, origin checks or rate limiting** to make development easier. Use `.dev.vars`
  locally instead.
- **Dependencies:** prefer none. New ones must have an open-source licence compatible with MIT; add them to
  `THIRD_PARTY_NOTICES.md`.
- **Accessibility:** keep keyboard operation, focus handling, announcements and reduced-motion behaviour working.
- **Style:** match the surrounding code. Double quotes for strings containing apostrophes; export components as default
  exports. TypeScript strict mode stays on.
- **Tests:** add or update a check in `scripts/` (or a Worker test) for logic you change.

## Pull requests

1. Fork and branch from `main`.
2. Make a focused change with a clear commit message.
3. Run the checks above.
4. Open a pull request using the template. Describe what changed and why, how you tested it, and any privacy or
   security impact. Screenshots help for UI changes.

Maintainers review for correctness, honesty of output, privacy, and security. Expect questions; they are about the code.
