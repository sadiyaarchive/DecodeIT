# Maintainer operations

This guide is for operators of the official hosted service. Designers install the Figma plugin and use it without
keys, Cloudflare accounts or backend configuration. Keep the existing endpoint:
`https://decodeit.sadiya-archives.workers.dev`.

**Release status:** account settings have not been verified by this local cleanup. Complete
[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) before launch. Commands below are instructions, not a record of actions
performed. Deployments, secret changes, repository visibility and history changes need explicit operator approval.

## API key security

- Keep `GEMINI_API_KEY` only in the official Worker's runtime secrets. Never put it in source, plugin builds, build
  variables, screenshots, issue reports, chat or shell command arguments.
- Use a dedicated Google project and restrict the key to the required Gemini/Generative Language API. Review who can
  read or change secrets and who can deploy code that runs with them.
- Local backend work can use a separate development key in git-ignored `worker/.dev.vars`. Do not print that file or
  copy production credentials into tests. Automated tests require no key.
- Before launch, rotate the existing key through the provider console and `npm run secret:gemini` in `worker/`.
  Enter the replacement only at the secure prompt, verify one non-sensitive decode, then revoke the old key. On
  suspected compromise, revoke the exposed key immediately even if that interrupts service.
- Record rotation date and verification outcome privately, never the secret value. Confirm the old key is revoked.

## Gemini plan, data terms and quotas

1. Confirm the exact Google project used by the deployed Worker, its billing/usage tier and `GEMINI_MODEL` value
   (repository setting: `gemini-3.5-flash-lite`). A model name or successful request does not establish data terms.
2. Review [Gemini API terms](https://ai.google.dev/gemini-api/terms) for the operator's region and intended audience.
   Confirm paid/unpaid treatment; the terms include age and regional availability restrictions, including paid-service
   requirements for clients offered in the EEA, Switzerland or UK. Resolve those requirements before a worldwide listing.
3. Confirm API logging, retention and dataset-sharing settings under [Google's logging policy](https://ai.google.dev/gemini-api/docs/logs-policy).
   Do not opt user designs into datasets or product-improvement sharing. Update `PRIVACY.md` with verified facts.
4. In [AI Studio rate limits](https://aistudio.google.com/rate-limit), inspect active model-specific RPM, TPM and RPD.
   These apply per project rather than per key. Set conservative adjustable limits where supported, document effective
   values and verify enforcement. Do not assume every quota can be lowered. See [rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits).
5. Review [Gemini billing controls](https://ai.google.dev/gemini-api/docs/billing), set available project spend caps and
   usage alerts, and assign someone to respond. Project caps can lag and allow overages; quotas bound requests/tokens,
   not an exact currency amount. If the account cannot enforce acceptable limits, keep public launch blocked.
6. Record an operator-approved usage allowance, alert thresholds and shutdown trigger privately. Check usage after
   launch and after any model, plan or quota change. Never infer the hosted plan from free-tier model availability.

## Rate limiting

`worker/wrangler.jsonc` declares `RATE_LIMITER`, namespace `1001`, at 10 requests per 60 seconds, keyed by
`cf-connecting-ip` in `worker/src/index.ts`. Confirm this binding exists on the **deployed** Worker. The code skips
throttling when it is absent; a passing build or healthy `/health` response does not prove protection is active.

Cloudflare's binding is approximate and local to each Cloudflare location. It is not a global request or spending cap.
Shared IPs can affect multiple designers. Origin checks restrict browser callers but scripts can omit or forge Origin.
See [Cloudflare rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

For an approved hosted check, send a small, bounded burst of intentionally invalid JSON requests with
`Origin: null` and `Content-Type: application/json` to `/v1/decode`. Input validation runs after the limiter, so allowed
requests return `400 bad_json` without reaching Gemini; throttled requests should return `429 rate_limit`. Allow time
for counters to settle and stop promptly; do not load-test the public endpoint or expect an exact eleventh-request cutoff.
Confirm the binding in the dashboard as well. Record time, request count and status codes without IPs or user content.
Recheck after the window resets. This verifies that path, not global abuse resistance or Gemini quotas.

## Observability and privacy

The repository enables Workers observability. Application failure logs contain only upstream HTTP status when available,
attempt number, elapsed time, failure category and available finish/block reason codes. Unknown reason values are replaced
with `UNKNOWN`; designs, prompts, results and keys are never logged. Gemini HTTP 503 is retried once within the original
25-second deadline; see [Worker retry handling](../worker/README.md#api). Platform invocation logs are separate from those application messages.
[Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) can include request/response
metadata and uncaught exceptions.

Before release, inspect deployed observability, invocation logging, sampling, retention, access permissions and any
Tail Worker, Logpush or other export destinations. Record actual values and update `PRIVACY.md`; do not describe the
service as having no logs. Avoid live tail sessions with real user submissions. Keep Google API logging/sharing review
separate. Choose and publish the operator identity and privacy contact before launch.

## Kill switch and recovery

There is no dedicated application feature flag. If abuse or an exposed key requires stopping AI calls:

1. With operator authorization, remove the runtime secret using `npx wrangler secret delete GEMINI_API_KEY` from
   `worker/`, or disable all active public Worker routes in Cloudflare. Confirm the account and Worker before acting.
2. Revoke a compromised key in Google as well. Route shutdown does not revoke a leaked key. In-flight calls may finish.
3. Verify shutdown with a non-sensitive request. Without the secret, `POST /v1/decode` returns `500 not_configured`
   before Gemini is called. `/health` still returns `ok: true`; it is a liveness check, not an AI readiness check.
4. Record incident timing and status codes privately. Tell users the hosted service is unavailable; Demo mode remains
   available. Never publish request content or credentials in an incident report.
5. Restore only after the cause is addressed: set a restricted replacement secret, confirm rate limiting and quotas,
   re-enable routes if needed and test one non-sensitive decode. Recheck logs and usage before wider availability.

Secret removal and route changes interrupt service; these are incident procedures, not routine local checks.

## Local Worker development

UI contributors should use `pnpm dev` with `?provider=demo`. Backend maintainers can run the Worker independently:

```bash
cd worker
npm ci
cp .dev.vars.example .dev.vars
# Add a separate development key privately, only if a live Gemini check is needed.
npm run dev
```

Tests use mocks and require no key. Call the local API directly for backend checks; the plugin stays fixed to the
official endpoint. For a separate local browser API harness only, put development origins in `.dev.vars`, never in
`wrangler.jsonc`. Keep the production allowlist `null` and do not add a plugin URL setting.

## Deployment precautions

Run locally before requesting approval to deploy:

```bash
pnpm run typecheck
pnpm run check
pnpm run build
pnpm run build:plugin
pnpm run check:bundle
cd worker
npm run typecheck
npm test
npm run build            # typecheck + wrangler deploy --dry-run; no deployment
```

Verify the reviewed branch/commit, target Cloudflare account and Worker name `decodeit`, configured model, origin
allowlist, rate-limit binding and privacy settings. Preserve the official URL and current Figma plugin ID. Save the
current deployment version for recovery; review a rollback's configuration and secret implications before using it.

Only after explicit deployment approval, an authorized maintainer can run `npm run deploy` from `worker/` and use
`npm run secret:gemini` for an approved secret update. Check `/health`, then a consented non-sensitive Figma decode;
verify quotas, limiter and logs independently. Do not claim a dry run deployed anything.

CI is validation only: no secrets and no deployment. If using Cloudflare Workers Builds, keep non-production branch
builds off and review any code before it can run with runtime secrets. Configure the production branch only after the
release-history decision. Never run fork code with production credentials or use `pull_request_target` to do so.
Protect the eventual public default branch with reviews and required checks, and keep deployment credentials scoped.
See [SECURITY.md](../SECURITY.md) and the release checklist for GitHub settings that still need confirmation.
