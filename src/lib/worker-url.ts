// The official hosted endpoint. Designers do not configure a backend.
// Plain erasable TypeScript so the plugin build and checks can use the same value.
export const OFFICIAL_WORKER_URL = 'https://decodeit.sadiya-archives.workers.dev';

/** Exactly the official Worker, with the same disclosure as the source manifest. */
export function officialNetworkAccess() {
  return {
    allowedDomains: [OFFICIAL_WORKER_URL],
    reasoning: `Decode It sends the selected frame image (or an uploaded screenshot), the pasted feedback and any optional notes to its own Cloudflare Worker at ${new URL(OFFICIAL_WORKER_URL).host}, which asks Google Gemini to interpret the feedback. This happens only after the user agrees in the plugin, and only when they press Decode. No other domains are contacted, and the Gemini API key is held by the Worker, never by the plugin.`,
  };
}
