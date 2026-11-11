import { describe, expect, it, vi } from "vitest";

import { cheapAnswer, forEdge, mayUseEdgeCache } from "./edge-cache";
import { createWorker, SITE_HOST, type FetchHandler } from "./handlers";

const at = (path: string, init?: RequestInit) => new Request(`https://${SITE_HOST}${path}`, init);
const signedIn = { headers: { cookie: "theme=dark; __session=jwt; __client_uat=1700000000" } };

describe("mayUseEdgeCache", () => {
  it("lets signed-out visitors, and everyone's share images, use the cache", () => {
    expect(mayUseEdgeCache(at("/"), SITE_HOST)).toBe(true);
    expect(mayUseEdgeCache(at("/", { method: "HEAD" }), SITE_HOST)).toBe(true);
    expect(mayUseEdgeCache(at("/opengraph-image", signedIn), SITE_HOST)).toBe(true);
  });

  it("keeps signed-in visitors, app pages, other hosts and client navigations away", () => {
    expect(mayUseEdgeCache(at("/", signedIn), SITE_HOST)).toBe(false);
    expect(mayUseEdgeCache(at("/", { headers: { cookie: "__client_uat_Abc12=0" } }), SITE_HOST)).toBe(false);
    expect(mayUseEdgeCache(at("/invite/abc"), SITE_HOST)).toBe(false);
    expect(mayUseEdgeCache(at("/dashboard"), SITE_HOST)).toBe(false);
    expect(mayUseEdgeCache(new Request("https://cutelyaskme.example.workers.dev/"), SITE_HOST)).toBe(false);
    expect(mayUseEdgeCache(at("/", { method: "POST" }), SITE_HOST)).toBe(false);
    expect(mayUseEdgeCache(at("/", { headers: { rsc: "1" } }), SITE_HOST)).toBe(false);
  });
});

describe("forEdge", () => {
  it("keeps a landing page for an hour, telling only the edge", () => {
    const page = new Response("<html>", { headers: { "Cache-Control": "private, no-store" } });
    const marked = forEdge(at("/"), page);
    expect(marked.headers.get("Cloudflare-CDN-Cache-Control")).toMatch(/^public, max-age=3600,/);
    expect(marked.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("never keeps a response that sets a cookie or is not a 200", () => {
    const withCookie = new Response("<html>", { headers: { "Set-Cookie": "__session=x; Path=/" } });
    expect(forEdge(at("/"), withCookie).headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
    const redirect = new Response(null, { status: 307, headers: { Location: "/dashboard" } });
    expect(forEdge(at("/"), redirect).headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
  });
});

describe("cheapAnswer", () => {
  it("answers the uptime check and scanner probes, and nothing else", () => {
    expect(cheapAnswer(at("/healthz"))?.status).toBe(200);
    for (const path of ["/.env", "/.git/config", "/wp-login.php", "/config/app.php"]) {
      expect(cheapAnswer(at(path))?.status).toBe(404);
    }
    for (const path of ["/", "/.well-known/security.txt", "/invite/abc", "/api/plans"]) {
      expect(cheapAnswer(at(path))).toBeNull();
    }
  });
});

describe("the default entrypoint", () => {
  const app = { fetch: vi.fn(async () => new Response("from next")) };
  const cached = vi.fn(async () => new Response("from cache"));
  const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn(), props: {}, exports: { CachedPages: { fetch: cached } } };
  const worker = createWorker(app as unknown as FetchHandler) as unknown as {
    fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>;
  };

  it("sends a signed-out landing page view to the cached entrypoint, and the rest to Next.js", async () => {
    expect(await (await worker.fetch(at("/"), {}, ctx)).text()).toBe("from cache");
    expect(await (await worker.fetch(at("/", signedIn), {}, ctx)).text()).toBe("from next");
    expect(await (await worker.fetch(at("/plan/abc"), {}, ctx)).text()).toBe("from next");
    expect((await worker.fetch(at("/healthz"), {}, ctx)).status).toBe(200);
    expect(app.fetch).toHaveBeenCalledTimes(2);
    expect(cached).toHaveBeenCalledTimes(1);
  });
});
