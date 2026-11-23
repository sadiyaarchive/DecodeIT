# Privacy

This describes what Decode It does with your data. It covers the plugin and the Worker in this repository, and the
official hosted service at `https://decodeit.sadiya-archives.workers.dev`. The plugin uses this service without
requiring an account, API key or backend configuration from you.

*This is a plain-language description, not legal advice. Maintainers: complete the three **TO COMPLETE** items under "The hosted instance" before the repository goes public.*

## Short version

- The plugin creates a **local PNG preview** of your selected design to show in its interface. Creating this preview
  does not send it to the hosted Decode It service or Google Gemini.
- In **live mode**, starting a decode sends the design preview (or your added screenshot), feedback and optional context
  to the hosted Decode It service, which sends them to Google Gemini. The first live decode asks you to **Agree and decode**;
  later decodes use your saved consent.
- **Please avoid confidential or sensitive information** in designs, screenshots, feedback and notes.
- The Worker **does not store** your content, and our code logs error status codes and error names. The services it runs on have their
  own handling, described below.
- **Demo mode** does not send your design, feedback or context to the hosted service or Google Gemini.
- No analytics, no cookies, no accounts, no advertising.

## Local design preview

When you open the plugin with a supported design selected, it uses Figma's local image export to create a PNG preview.
It creates a new preview when you change the selection, switch pages or press **Refresh**, provided a supported design
is selected. Selection and page changes have a short delay (150 milliseconds) before the preview updates.

The preview is passed from Figma to the plugin interface through Figma's internal messaging so you can see the design
you are working with. This happens even before you agree to live decoding. **Exporting and displaying the local preview
alone does not send your design to the hosted Decode It service or Google Gemini.**

## What is sent, and when

When you start a live decode, the plugin sends the information below to the hosted Decode It service, which forwards it
to Google Gemini to generate suggestions. The first time, the button says **Agree and decode**. Your agreement is
remembered; while that saved consent is available, later live decodes do not ask you to agree again. Each transmission
still requires you to start a live decode, using the button or a supported keyboard shortcut.

| Data | Source | Sent to |
|---|---|---|
| An image of the selected frame (a PNG scaled toward a 720 x 2400 px preview bound, subject to Figma's minimum export scale) or the screenshot you added | Figma selection or your upload | Worker, then Gemini |
| The feedback text (up to 1,000 characters) | What you typed or pasted | Worker, then Gemini |
| Optional notes: what the design is, who it is for, what it should do | The "A little more context" fields | Worker, then Gemini |
| The design's name and size (for example "Pricing page, 390 x 640") | Figma or the file name | Worker, then Gemini |

Nothing else is read from your Figma file. The plugin does not read other frames, comments, or file content, and does
not change your document.

Your **IP address** is visible to the Worker (and Cloudflare) because that is how internet requests work. The Worker uses
it only as the key for the rate limiter.

## What the Worker does with it

The Worker (`worker/`) validates the request, builds a prompt, calls the Gemini API and returns the result. It keeps no
database and writes no files. It does not log the image, the feedback or the notes. On failures, application logs contain an upstream status
code or an error name, not request or response bodies. You can read the code to confirm this.

## Third parties

- **Cloudflare** runs the Worker. Cloudflare processes requests as part of providing the service and can show request
  metadata (such as URL, status and time) in the Worker's dashboard if observability is enabled, which it is in the
  repository configuration. Deployed settings remain unverified. See [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
  and [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/).
- **Google (Gemini API)** receives your image, feedback and notes. Data handling depends on the applicable service
  terms, account setup and region. Unpaid-service terms can allow product improvement and human review; paid-service
  treatment differs. The hosted plan is **not yet confirmed**. We cannot promise that content is excluded from model
  improvement until this is verified. See [Gemini API terms](https://ai.google.dev/gemini-api/terms).
  Google also offers optional API logging and dataset sharing; the hosted project's settings need verification under
  [Google's logging policy](https://ai.google.dev/gemini-api/docs/logs-policy).

## What stays on your device

- Whether you have pressed **Agree and decode** is remembered so you are not asked again. In Figma it is stored with
  `figma.clientStorage` on your computer, and in a plain browser it falls back to `localStorage`.
- The plugin keeps no history of your feedback or results. Closing the plugin discards them.
- The result can be copied to your clipboard when you press **Copy summary**. That copy stays with you.

## AI output

Results are generated by an AI model. They are suggestions and guesses, can be wrong or miss things, and should not be
treated as facts about what a reviewer meant. Ask the reviewer when it matters.

## Your choices

- Use **Demo mode** to avoid sending your design, feedback or context to the hosted Decode It service or Google Gemini.
- If you have not agreed before, decline by not pressing **Agree and decode**. If you have already agreed, avoid starting
  a live decode to prevent a new submission. Local previews can still be created and shown in the plugin interface.

## The hosted instance

What the repository itself shows (you can check it in [`worker/wrangler.jsonc`](worker/wrangler.jsonc)):

- Workers observability is **enabled** in the project's Worker configuration (`"observability": { "enabled": true }`). The
  Worker's own code logs upstream status codes or error names on failure.
- The configuration declares a per-IP rate-limit binding (10 requests per 60 seconds). Its deployed binding has not
  been verified. The code skips throttling if that binding is absent; the binding is approximate, not a global cap.
  See [maintainer operations](docs/OPERATIONS.md#rate-limiting).

What this document cannot state until the operator decides it:

- **TO COMPLETE:** the name or project identity of the operator of the hosted instance, and a contact address for privacy
  requests (a project mailbox rather than a personal one).
- **TO COMPLETE:** the hosted Gemini plan, applicable data terms, and API logging/dataset-sharing settings.
- **TO COMPLETE:** whether the Cloudflare dashboard settings of the deployed Worker match `wrangler.jsonc` (for example
  observability and log retention), because the dashboard can differ from the file.

## Changes

Changes to this document are made in the repository and visible in its history. If the data flow changes (for example a
new service), the in-plugin notice and the manifest disclosure are updated in the same change.
