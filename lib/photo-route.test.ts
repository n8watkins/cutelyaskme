import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "sender-1" as string | null,
  cache: new Map<string, unknown>(),
  budgetAllowed: true,
  reserved: 0,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: state.userId }),
}));
vi.mock("@/lib/place-cache", () => ({
  cacheGet: async (key: string) => (state.cache.has(key) ? state.cache.get(key) : undefined),
  cacheSet: async (key: string, value: unknown) => {
    state.cache.set(key, value);
  },
}));
vi.mock("@/lib/api-budget", () => ({
  reserveTrackedApiCall: async () => {
    state.reserved += 1;
    return state.budgetAllowed;
  },
}));
vi.mock("@/lib/api-usage", () => ({ trackApiUsage: async () => undefined }));

import { GET } from "../src/app/api/photo/route";

const PLACEHOLDER = "http://localhost/assets/venue-placeholder.svg";

function photoRequest(name = "places/place-1/photos/ref-a"): NextRequest {
  return new NextRequest(`http://localhost/api/photo?name=${encodeURIComponent(name)}`);
}

function mockGoogle(status: number, body: unknown = {}) {
  const fetchMock = vi.fn(async () => Response.json(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe.sequential("venue photo proxy", () => {
  beforeEach(() => {
    state.userId = "sender-1";
    state.cache.clear();
    state.budgetAllowed = true;
    state.reserved = 0;
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects to the photo and lets the browser keep it for a day", async () => {
    mockGoogle(200, { photoUri: "https://lh3.googleusercontent.com/p/abc" });
    const response = await GET(photoRequest());
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://lh3.googleusercontent.com/p/abc");
    expect(response.headers.get("cache-control")).toBe("private, max-age=86400");
  });

  it("caches by place, so a different photo ref for the same place costs nothing", async () => {
    const google = mockGoogle(200, { photoUri: "https://lh3.googleusercontent.com/p/abc" });
    await GET(photoRequest("places/place-1/photos/ref-a"));
    const again = await GET(photoRequest("places/place-1/photos/ref-b"));
    expect(again.headers.get("location")).toBe("https://lh3.googleusercontent.com/p/abc");
    expect(google).toHaveBeenCalledTimes(1);
    expect(state.reserved).toBe(1);
  });

  it("shows the placeholder instead of a broken image when the daily budget is spent", async () => {
    const google = mockGoogle(200, { photoUri: "unused" });
    state.budgetAllowed = false;
    const response = await GET(photoRequest());
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(PLACEHOLDER);
    expect(response.headers.get("x-photo-fallback")).toBe("quota");
    expect(google).not.toHaveBeenCalled();
  });

  it("stops calling Google for a while once Google reports the quota exhausted", async () => {
    const google = mockGoogle(429, { error: { status: "RESOURCE_EXHAUSTED" } });
    const first = await GET(photoRequest("places/place-1/photos/ref-a"));
    expect(first.headers.get("location")).toBe(PLACEHOLDER);
    const second = await GET(photoRequest("places/place-2/photos/ref-a"));
    expect(second.headers.get("x-photo-fallback")).toBe("quota");
    expect(google).toHaveBeenCalledTimes(1);
    expect(state.reserved).toBe(1);
  });

  it("remembers places without a photo", async () => {
    const google = mockGoogle(404);
    await GET(photoRequest());
    const again = await GET(photoRequest());
    expect(again.headers.get("x-photo-fallback")).toBe("missing");
    expect(google).toHaveBeenCalledTimes(1);
  });

  it("falls back when Places is not configured, and rejects bad input", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    expect((await GET(photoRequest())).headers.get("x-photo-fallback")).toBe("unavailable");
    expect((await GET(photoRequest("not-a-photo"))).status).toBe(400);
    state.userId = null;
    expect((await GET(photoRequest())).status).toBe(401);
  });
});
