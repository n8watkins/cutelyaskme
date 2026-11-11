// The Worker's own edge cache (Workers Cache, https://developers.cloudflare.com/workers/cache/).
//
// The default entrypoint (worker/handlers.ts) runs on every request and is cheap: it
// decides here whether a request may be answered from the cache, and if so passes it to
// the CachedPages entrypoint (worker/index.ts), which Cloudflare's cache sits in front
// of (wrangler.jsonc "cache" and "exports"). A hit returns the stored response without
// running Next.js, so it costs no CPU time.
//
// Only a short list of paths may be cached, all the same for everyone who may get them:
// - the landing page, for visitors without a Clerk session cookie (a signed-in visitor
//   at "/" is sent to the dashboard, so they always reach Next.js);
// - the share images and the manifest, for everyone.
// Invites, plans and every signed-in page stay uncached, and a response is only kept
// if it is a 200 that sets no cookie.
//
// The cached landing page keeps the CSP nonce it was rendered with. That is safe here:
// the page shows nothing from the request, so there is nothing a reused nonce could let
// through. Each deploy starts with an empty cache (the Worker version is part of the key).

/** The landing page: fresh for an hour, then refreshed in the background. */
const PAGE_TTL_SECONDS = 3600;

/** Share images and the manifest change only with a deploy. */
const STATIC_TTL_SECONDS = 86_400;

const EDGE_STALE_SECONDS = 86_400;

/** Path -> seconds, and whether a signed-in visitor gets something else there. */
const CACHEABLE: Record<string, { ttl: number; signedOutOnly: boolean }> = {
  "/": { ttl: PAGE_TTL_SECONDS, signedOutOnly: true },
  "/opengraph-image": { ttl: STATIC_TTL_SECONDS, signedOutOnly: false },
  "/twitter-image": { ttl: STATIC_TTL_SECONDS, signedOutOnly: false },
  "/manifest.webmanifest": { ttl: STATIC_TTL_SECONDS, signedOutOnly: false },
};

/** Clerk's session cookies (`__session`, `__client_uat`, and their per-instance copies). */
const SESSION_COOKIE = /(?:^|;\s*)(?:__session|__client_uat)(?:_[\w-]+)?=/;

/** Whether this request may be answered from the edge cache. */
export function mayUseEdgeCache(request: Request, host: string): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const url = new URL(request.url);
  // The cache key has no host in it, so workers.dev never reads or writes it.
  if (url.hostname !== host) return false;
  const rule = CACHEABLE[url.pathname];
  if (!rule) return false;
  if (request.headers.has("authorization")) return false;
  // Client-side navigations ask for the page's RSC payload, not its HTML.
  if (request.headers.has("rsc") || request.headers.has("next-router-prefetch")) return false;
  if (rule.signedOutOnly && SESSION_COOKIE.test(request.headers.get("cookie") ?? "")) return false;
  return true;
}

/**
 * The response marked for the edge: kept for its path's time when it is a 200 that sets
 * no cookie, otherwise never. The Cloudflare-CDN-Cache-Control header is read by
 * Cloudflare and never reaches browsers, which keep the Cache-Control Next.js sent.
 */
export function forEdge(request: Request, response: Response): Response {
  const rule = CACHEABLE[new URL(request.url).pathname];
  const marked = new Response(response.body, response);
  const cacheable = Boolean(rule) && response.status === 200 && !marked.headers.has("set-cookie");
  marked.headers.set(
    "Cloudflare-CDN-Cache-Control",
    cacheable
      ? `public, max-age=${rule.ttl}, stale-while-revalidate=${EDGE_STALE_SECONDS}`
      : "no-store",
  );
  return marked;
}

/** Scanners probing for /.env, /.git/config, /wp-admin and *.php: answered before Next.js. */
const PROBE = /^\/(?:\.(?!well-known\/)|wp-|.*\.php$)/i;

/** A plain answer for the uptime check and for scanners, or null for everything else. */
export function cheapAnswer(request: Request): Response | null {
  const { pathname } = new URL(request.url);
  if (pathname === "/healthz") {
    return new Response("ok", {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  if (PROBE.test(pathname)) {
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return null;
}
