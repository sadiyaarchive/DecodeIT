## What and why

<!-- What does this change, and why? Link the issue it closes. -->

## How I tested it

<!-- Commands you ran, what you tried in Figma or the dev server. Screenshots for UI changes. -->

## Checklist

- [ ] `pnpm run typecheck`, `pnpm run check`, `pnpm run build`, `pnpm run build:plugin` pass
- [ ] `cd worker && npm run typecheck && npm test` pass (if the Worker changed)
- [ ] No secrets, keys, `.dev.vars` or `.env*` files are included
- [ ] No new network domains, and no tokens or credentials in the plugin
- [ ] Worker validation, origin checks and rate limiting are not weakened
- [ ] If what is sent, where, or what is stored changed: in-plugin notice, `PRIVACY.md` and manifest reasoning updated
- [ ] New dependencies (if any) are MIT-compatible and listed in `THIRD_PARTY_NOTICES.md`
- [ ] Output stays honest: guesses labelled as guesses, demo labelled as demo
