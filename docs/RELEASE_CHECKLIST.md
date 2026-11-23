# Public release checklist

This checklist separates local preparation from external verification and owner decisions. Unchecked items block
public launch; earlier test reports are not proof of current dashboard or hosted configuration. Record evidence and
dates without secrets, personal email addresses, IP addresses or private design content.

## Local preparation

- [x] Official Worker URL retained; no custom URL or plugin ID build override.
- [x] Designer-first README with honest pending-Community installation status.
- [x] User self-hosting guide removed; contributor workflow and maintainer operations retained.
- [x] MIT source licence retained; original logo and archived mascot files preserved.
- [x] Current typechecks, logic checks, builds, Worker tests and bundle dry run passed; see evidence below.
- [x] Current browser smoke checks passed (163/163); browser simulation does not replace real Figma checks.

## Operator and account decisions

- [ ] Confirm hosted Gemini plan, applicable data terms, operator region and intended audience/availability.
- [ ] Confirm Gemini API logging, retention and dataset-sharing settings; complete `PRIVACY.md`.
- [ ] Confirm deployed Cloudflare observability, invocation logging, sampling, retention and exports; complete `PRIVACY.md`.
- [ ] Publish operator identity and a project privacy contact; provide a fallback security contact.
- [ ] Verify deployed `RATE_LIMITER` and bounded hosted throttling behaviour; the code skips throttling if unbound.
- [ ] Configure and verify Gemini quotas/spend controls, alert owner and kill-switch procedure.
- [ ] Rotate the Gemini key before launch, verify the replacement and revoke the previous key.
- [ ] Decide logo licensing (MIT or reserved) and align `assets/brand/README.md` and the root licence wording.
- [ ] Confirm GitHub private vulnerability reporting, secret scanning/push protection, Dependabot and branch protection.

## Repository history — explicit approval required

The old `main` history contains a personal email according to the owner's report. Do not publish or rewrite it as part
of routine cleanup. Do not copy that address into a report. `oss-clean` is the candidate source snapshot.

Choose an approach after reviewing what must be preserved:

- Publish the approved clean history in a new public repository, leaving the old repository private; account for links,
  issues, releases and repository-name availability.
- Replace history in the existing repository under a separately approved plan, including backup, collaborator impact,
  branch/tag/default-branch review and any remote references or cached copies that may retain old commits.

Neither option has been performed. A cleaned working tree alone does not remove commit metadata. Verify the exact
refs intended for public release and inspect author/committer metadata privately before approval. Do not push `--all`,
mirror, change visibility, force-push, delete refs or modify `main` during local preparation.

## Real Figma and publishing

- [ ] Run the [manual plugin checklist](../plugin/README.md#manual-test-checklist) in real Figma.
- [ ] Verify first-use consent cannot be bypassed by keyboard shortcuts, plus focus after results/errors and cancellation.
- [ ] Verify the built manifest's official-only network access and a non-sensitive Figma-to-Gemini decode.
- [ ] Confirm clipboard behaviour, selection updates and reopening the plugin.
- [ ] Record Figma version, build revision, date and outcomes without private design data.
- [ ] Obtain explicit approval for the chosen GitHub publication/history actions and any deployment.
- [ ] At Community publishing, confirm the plugin ID and listing assets; replace the README's pending-installation notice
      with the verified Community link. Do not claim the plugin is published before it is.

## Local verification — 23 November 2026

Verified on the uncommitted cleanup over `oss-clean` commit `20c56a0`, using Node 24.15.0 and existing installed
dependencies. Package scripts were run via `npm run`; the available pnpm launcher was version 11 while the repository
pins pnpm 10. No dependency or lockfile updates were made. A fresh dependency install was not repeated in this pass.

- App and Figma sandbox typechecks passed.
- All six logic-check scripts passed, including 58 matching cases, 12 demo scenarios, provider and manifest checks.
- Browser UI and self-contained plugin builds passed.
- The plugin build ignored deliberately supplied obsolete URL/ID settings; bundle checks confirmed the official
  endpoint, source plugin ID, embedded assets and absence of secret markers. CI now includes this regression check;
  remote CI was not run.
- Worker typecheck and all 7 Worker tests passed. The bundle dry run passed and declared the expected rate limiter;
  this does not verify the deployed binding.
- Existing browser smoke suite passed **163/163** in headless Chrome against the local Demo-mode preview.
  External requests were blocked by the test harness; none were attempted.
- Local documentation links and diff whitespace checks passed. A limited scan found no Gemini-key-shaped strings in
  tracked working-tree files; this is not a full secret/history audit.
- Original logo, archive, source licence, source manifest, Worker runtime code and lockfiles match the starting commit.
  `main` remains at `6188098`; no commit, push, deploy, visibility change or history rewrite was performed.

No hosted API calls, dashboard changes, secret rotation or real Figma checks were performed in this pass. All unchecked
release gates above remain open.
