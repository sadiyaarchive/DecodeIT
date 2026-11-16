// Which Decode It Worker the plugin talks to, and the Figma `networkAccess` that goes with it.
//
// Set DECODEIT_WORKER_URL when building (dev server or plugin) to use your own Worker. Unset, the
// project's hosted Worker is used. This file is plain erasable TypeScript with no imports so the
// Vite configs, build script and check scripts can all load it in Node.

/** The hosted Worker the project ships with. */
export const DEFAULT_WORKER_URL = 'https://decodeit.sadiya-archives.workers.dev';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

export interface ResolvedWorkerUrl {
  /** Origin only, no trailing slash. */
  url: string;
  host: string;
  /** http://localhost etc. Allowed for development builds only. */
  local: boolean;
}

/**
 * Validates DECODEIT_WORKER_URL. Throws an Error with a fix-it message so a bad value stops the build
 * instead of shipping a plugin that cannot reach (or can reach the wrong) server.
 */
export function resolveWorkerUrl(raw?: string | null): ResolvedWorkerUrl {
  const input = (raw ?? '').trim() || DEFAULT_WORKER_URL;
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    throw new Error(`DECODEIT_WORKER_URL is not a valid URL: "${input}". Example: https://my-decodeit.my-subdomain.workers.dev`);
  }
  const local = LOCAL_HOSTS.includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) {
    throw new Error(`DECODEIT_WORKER_URL must use https (http is only accepted for localhost): "${input}".`);
  }
  if (u.username || u.password) throw new Error('DECODEIT_WORKER_URL must not contain credentials.');
  if (input.includes('*')) throw new Error('DECODEIT_WORKER_URL must not contain wildcards.');
  if ((u.pathname !== '/' && u.pathname !== '') || u.search || u.hash) {
    throw new Error(`DECODEIT_WORKER_URL must be the Worker's origin only, with no path, query or fragment. Use "${u.origin}".`);
  }
  return { url: u.origin, host: u.host, local };
}

export interface NetworkAccess {
  allowedDomains: string[];
  devAllowedDomains?: string[];
  reasoning: string;
}

/** The manifest `networkAccess` for a Worker: exactly that origin, nothing else. */
export function networkAccessFor(worker: ResolvedWorkerUrl): NetworkAccess {
  if (worker.local) {
    return {
      allowedDomains: ['none'],
      devAllowedDomains: [worker.url],
      reasoning: `This is a development build. In development only, Decode It sends the selected frame image (or an uploaded screenshot), the pasted feedback and any optional notes to a Worker running on ${worker.host}. Release builds use an https Worker.`,
    };
  }
  return {
    allowedDomains: [worker.url],
    reasoning: `Decode It sends the selected frame image (or an uploaded screenshot), the pasted feedback and any optional notes to its own Cloudflare Worker at ${worker.host}, which asks Google Gemini to interpret the feedback. This happens only after the user agrees in the plugin, and only when they press Decode. No other domains are contacted, and the Gemini API key is held by the Worker, never by the plugin.`,
  };
}
