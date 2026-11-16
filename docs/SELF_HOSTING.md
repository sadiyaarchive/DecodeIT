# Self-hosting Decode It

Decode It has two parts: the Figma plugin (no secrets) and a small Cloudflare Worker that holds your Google Gemini API
key and calls Gemini. To run your own, you deploy the Worker with your key, then build the plugin pointing at it.
Your key never goes into the plugin, the repository, or any build setting that reaches the browser.

**You will need:** Node.js 22.18+ (24 recommended), pnpm 10, a free [Cloudflare](https://dash.cloudflare.com) account,
a Google AI Studio API key, and Figma Desktop.

## 1. Get a Gemini API key

1. Create a key at <https://aistudio.google.com/apikey>.
2. Treat it like a password. Do not paste it into chat, issues, commits, `wrangler.jsonc` or the plugin.
3. Read the cost and privacy notes in [Protecting your key and your wallet](#protecting-your-key-and-your-wallet) and
   [PRIVACY.md](../PRIVACY.md) first. The free tier is rate limited and Google may use free-tier prompts to improve its
   products. Paid usage is billed to you.

## 2. Configure the Worker

```bash
git clone https://github.com/sadiyaarchive/DecodeIT.git
cd DecodeIT/worker
npm install
```

Edit `worker/wrangler.jsonc` (these are public, non-secret settings):

| Setting | What to do |
|---|---|
| `name` | **Change it** to something unique to you, for example `my-decodeit`. It becomes part of your URL. If you keep `decodeit` you will be deploying to (or fighting with) that name in your own account. |
| `vars.GEMINI_MODEL` | Model id. Leave the default unless you know you need another one. |
| `vars.ALLOWED_ORIGINS` | Leave as `"null"`. Figma plugin iframes send `Origin: null`. Do not add `*`. |
| `vars.MAX_IMAGE_BYTES` | Image size cap in bytes (default 4,000,000). The plugin refuses larger images before sending. |
| `ratelimits[0].namespace_id` | Any integer unique within your Cloudflare account. `simple.limit` / `period` set the per-IP throttle (default 10 per 60 s). |

## 3. Deploy the Worker and add your key

```bash
npx wrangler login                      # opens a browser to authorise Wrangler
npm run deploy                          # prints https://<name>.<subdomain>.workers.dev
npx wrangler secret put GEMINI_API_KEY  # paste the key at the prompt; it is stored encrypted in Cloudflare
```

Until the secret is set the Worker answers `500 not_configured`. Check it:

```bash
curl https://<name>.<subdomain>.workers.dev/health
# {"ok":true,"model":"gemini-..."}
```

The secret lives only in Cloudflare. It is not in your repo, and `.dev.vars` (used locally) is git-ignored.

## 4. Build the plugin for your Worker

From the repository root:

```bash
pnpm install
DECODEIT_WORKER_URL=https://<name>.<subdomain>.workers.dev pnpm run build:plugin
```

`DECODEIT_WORKER_URL` must be your Worker's **origin**: `https` (plain `http` only for `localhost`), no path, no
credentials, no wildcard. A bad value stops the build with an explanation. The build writes the URL into the UI **and**
derives `networkAccess.allowedDomains` in `dist-plugin/manifest.json` from it, so the manifest can never allow a
different domain than the UI talks to. The disclosure text in the manifest is generated from the same value.

Optional: `DECODEIT_PLUGIN_ID=<your id>` replaces the placeholder plugin id in the built manifest. You only need this if
you publish your own copy through Figma.

## 5. Load it in Figma Desktop

**Plugins → Development → Import plugin from manifest…** → `dist-plugin/manifest.json`. Run **Decode It**, select a
frame, paste some feedback, and press **Agree and decode**. Use a throwaway design for the first test.

## Local development

Run the Worker on your machine with a key in a git-ignored file:

```bash
cd worker
cp .dev.vars.example .dev.vars     # then put your key in .dev.vars; never commit it
npm run dev                        # http://localhost:8787
```

- **In Figma:** `DECODEIT_WORKER_URL=http://localhost:8787 pnpm run build:plugin`. A localhost URL produces a
  development manifest (`allowedDomains: ["none"]`, `devAllowedDomains: ["http://localhost:8787"]`), so it works only
  for plugins imported in development.
- **In a browser tab** (`DECODEIT_WORKER_URL=http://localhost:8787 pnpm dev`): browsers send a real `Origin`, so add it
  **in `worker/.dev.vars` only**: `ALLOWED_ORIGINS=null,http://localhost:8443`. Never put development origins in
  `wrangler.jsonc` or a deployed Worker.

## Protecting your key and your wallet

Anyone who learns your Worker URL can call it, because the plugin cannot hold a secret (anything shipped in a plugin
can be extracted, so **do not add a shared token to the plugin**; it would add no real protection). Plan for that:

| Layer | What it does | How |
|---|---|---|
| Per-IP rate limit (built in) | Stops one address from hammering the Worker | The `ratelimits` binding in `wrangler.jsonc` (default 10 requests per minute). Keep it. |
| Request limits (built in) | Bounds the cost of each request | Image size cap, 1,000-character feedback cap, capped output tokens. |
| **Hard spending ceiling at Google** | The only limit that bounds the total | Use the **free tier**, which cannot bill you, or if you enable billing, set low per-day **quotas** for the Gemini API in Google Cloud Console (APIs & Services → Quotas). Budgets and alerts notify you but do not stop spending by themselves. |
| Restrict the key | Limits damage if it leaks | In Google Cloud Console, restrict the key to the Generative Language API. Use a dedicated project for Decode It. |
| Cloudflare plan limits | A natural ceiling on requests | The Workers Free plan has a daily request cap. If you move to a paid plan, set usage notifications. |
| Rate rules on your own domain | Edge-level throttling before the Worker runs | WAF rate limiting rules apply to domains on your Cloudflare zone, **not** to `*.workers.dev`. If you attach a custom domain (route) to the Worker, add a rate limiting rule for `/v1/decode`. |
| Alerts | You notice abuse early | Check the Gemini usage dashboard and `npx wrangler tail`. Logs record status codes only, never feedback or images. |
| Kill switch | Stops everything in a minute | `npx wrangler secret delete GEMINI_API_KEY` (Worker then answers `500 not_configured`), revoke the key in AI Studio, or disable the `workers.dev` route in the dashboard. |

Cloudflare and Google change plans and limits. Check their current documentation when you set these up.

If abuse persists you will need per-user identity, which this project does not provide. Do not rely on the `Origin`
check: it only stops other *websites* from calling the Worker from a browser, not scripts.

## Deploying from Git (optional) without exposing the key

- **Cloudflare Workers Builds:** build `main` only. Leave non-production branch builds **off**: a preview version of a
  Worker runs with the Worker's runtime secrets, so building a pull request would let its code read your key. See
  `worker/README.md` for the settings. Set `GEMINI_API_KEY` as a Worker *Secret*, never as a build variable.
- **GitHub Actions:** this repository's CI runs on pull requests with no secrets and does not deploy. If you add a deploy
  workflow, trigger it only on pushes to `main`, require an approval-gated Environment for the Cloudflare token, scope
  that token to the one Worker, and never use `pull_request_target` with code from a fork.
- **Maintainers:** protect `main` (required reviews and passing CI) so unreviewed code cannot reach production.

## Updating and troubleshooting

| Symptom | Likely cause |
|---|---|
| "Couldn't reach the decoder" | Wrong `DECODEIT_WORKER_URL` at build time, or the manifest does not match it. Rebuild, re-import the plugin. |
| `500 not_configured` | `GEMINI_API_KEY` is not set on the Worker. Run `wrangler secret put GEMINI_API_KEY`. |
| `403 forbidden_origin` | `ALLOWED_ORIGINS` does not include the caller's origin (Figma sends `null`). |
| `429 rate_limit` | Your per-IP limit or Gemini quota was hit. Wait a minute, or check your quota. |
| `413 / image too large` | The frame image is over `MAX_IMAGE_BYTES`. Select a smaller frame or upload a smaller screenshot. |
| Build fails: `DECODEIT_WORKER_URL ...` | The value is not a valid origin (see step 4). |
