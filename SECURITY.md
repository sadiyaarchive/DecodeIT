# Security policy

## Reporting a vulnerability

**Please do not open a public issue for security problems.** Use GitHub's private reporting: on the repository page choose
**Security → Report a vulnerability**. *(Maintainers: enable "Private vulnerability reporting" in the repository's
Security settings before making the repository public, and add a fallback contact address here.)*

Include what you found, how to reproduce it, and the impact. Reports are handled on a best-effort basis by volunteers. We will
keep you updated and credit you if you wish. This is a volunteer project and cannot offer a bounty.

## Scope

In scope: the Worker (`worker/`), the plugin code and UI (`plugin/`, `src/`), the build scripts, and the hosted instance's
configuration as described in this repository.

Out of scope: vulnerabilities in Figma, Cloudflare, Google or npm packages themselves (report them to the vendor), social
engineering, and denial of service by sheer traffic volume against the hosted instance (see "Known limits").

## How the project protects secrets

- The Gemini API key exists only as a **Cloudflare Worker secret**. It is not in the repository, `wrangler.jsonc`, the
  plugin bundle, build variables or CI. `.dev.vars` is git-ignored; `.dev.vars.example` has a placeholder.
- The plugin has **no shared token** and no credentials of any kind. Anything in a plugin can be extracted, so a shared
  token would only look like protection.
- CI runs on pull requests **without any secrets** and never deploys. It also fails the build if the plugin bundle
  contains anything resembling a Gemini key.
- The Worker rejects unknown origins, enforces size and shape limits, applies a per-IP rate limit, and re-validates the
  model's JSON before returning it. Feedback and notes are passed to the model as quoted data with an instruction to
  ignore instructions inside them.
- Worker failure logs contain only upstream HTTP status, attempt number, elapsed time, failure category and available
  finish/block reason codes. Unknown reason values are redacted. Images, feedback, notes, generated text and keys are never logged.
  Cloudflare invocation logs and any Google API logging are separate; confirm their settings before release.

If you ever find a real key in this repository or its history, report it privately at once so it can be revoked.

## Known limits (please read before reporting)

- **The endpoint is public.** The `Origin: null` allowlist blocks other *websites* from calling the Worker from a browser;
  it does not stop scripts. Abuse resistance is the per-IP rate limit, request caps, verified provider quotas and spending controls,
  and monitoring. The rate-limit binding is approximate and the code skips it when missing; production verification
  is required. See [docs/OPERATIONS.md](docs/OPERATIONS.md).
- **Prompt injection** cannot be fully prevented. A malicious design image or feedback might steer the model's wording.
  The Worker's output validation limits what can come back (fixed JSON shape, length limits), and the plugin renders it as
  plain text. It has no tools and no access to your other data.
- **Third-party processing.** Your content is processed by Cloudflare and Google. See [PRIVACY.md](PRIVACY.md).

## For maintainers: hardening checklist

- [ ] Protect `main`: require pull request review and the CI checks to pass; no force pushes.
- [ ] Cloudflare Workers Builds: production branch only; **non-production branch builds off** (previews run with the
      Worker's secrets).
- [ ] Never use `pull_request_target` to run code from forks. If a deploy workflow is added: push to `main` only,
      approval-gated Environment, token scoped to the single Worker.
- [ ] Gemini key in a dedicated Google Cloud project, restricted to the Generative Language API, with verified model-specific quotas
      and applicable spend controls. Do not treat quotas or delayed billing controls as an exact monetary ceiling.
- [ ] Rotate the Gemini key before the repository goes public, and after any suspected exposure.
- [ ] Turn on GitHub secret scanning and push protection, and Dependabot alerts.
- [ ] Review `.github/` workflows and `wrangler.jsonc` changes with extra care.
