import { describe, it, expect, afterEach, vi } from "vitest";
import {
  buildStaticMapUrl,
  browserStaticMapUrl,
  numberedStopMarkers,
  signedStaticMapUrl,
  signUrlPath,
  STATIC_MAP_PATH,
  STATIC_STOP_COLORS,
} from "./static-map";

const KEY = "test-key";
const LA = { lat: 34.0537, lng: -118.2428 };
const SM = { lat: 34.0084, lng: -118.4987 };

function paramsOf(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe("buildStaticMapUrl", () => {
  it("targets the staticmap endpoint with retina defaults", () => {
    const url = buildStaticMapUrl({ key: KEY });
    const u = new URL(url);
    expect(u.origin).toBe("https://maps.googleapis.com");
    expect(u.pathname).toBe(STATIC_MAP_PATH);
    expect(u.searchParams.get("size")).toBe("600x300");
    expect(u.searchParams.get("scale")).toBe("2");
    expect(u.searchParams.get("key")).toBe(KEY);
  });

  it("honors explicit size and scale", () => {
    const p = paramsOf(buildStaticMapUrl({ key: KEY, width: 400, height: 200, scale: 1 }));
    expect(p.get("size")).toBe("400x200");
    expect(p.get("scale")).toBe("1");
  });

  it("formats numbered colored markers in Google syntax", () => {
    const p = paramsOf(
      buildStaticMapUrl({ key: KEY, markers: [{ ...LA, label: "1", color: "#ff7aaa" }] }),
    );
    expect(p.getAll("markers")).toEqual(["color:0xff7aaa|label:1|34.05370,-118.24280"]);
  });

  it("uppercases letter labels and drops invalid ones", () => {
    const p = paramsOf(
      buildStaticMapUrl({
        key: KEY,
        markers: [
          { ...LA, label: "a" },
          { ...SM, label: "10" },
        ],
      }),
    );
    const [first, second] = p.getAll("markers");
    expect(first).toContain("label:A");
    expect(second).not.toContain("label:");
  });

  it("supports marker sizes for waypoint pins", () => {
    const p = paramsOf(
      buildStaticMapUrl({ key: KEY, markers: [{ ...LA, size: "small", color: "#3a2530" }] }),
    );
    expect(p.getAll("markers")[0]).toBe("size:small|color:0x3a2530|34.05370,-118.24280");
  });

  it("draws a weighted path through 2+ points and skips fewer", () => {
    const withPath = paramsOf(buildStaticMapUrl({ key: KEY, path: [LA, SM] }));
    expect(withPath.get("path")).toBe(
      "color:0xff7aaa|weight:3|34.05370,-118.24280|34.00840,-118.49870",
    );
    const withoutPath = paramsOf(buildStaticMapUrl({ key: KEY, path: [LA] }));
    expect(withoutPath.get("path")).toBeNull();
  });

  it("accepts center as an address string or coordinates, plus zoom", () => {
    const byAddress = paramsOf(buildStaticMapUrl({ key: KEY, center: "Austin, TX", zoom: 12 }));
    expect(byAddress.get("center")).toBe("Austin, TX");
    expect(byAddress.get("zoom")).toBe("12");
    const byPoint = paramsOf(buildStaticMapUrl({ key: KEY, center: LA }));
    expect(byPoint.get("center")).toBe("34.05370,-118.24280");
  });

  it("applies the minimal style preset by default and soft on request", () => {
    const minimal = paramsOf(buildStaticMapUrl({ key: KEY })).getAll("style");
    expect(minimal).toContain("feature:poi|visibility:off");
    expect(minimal.join()).not.toContain("saturation");
    const soft = paramsOf(buildStaticMapUrl({ key: KEY, style: "soft" })).getAll("style");
    expect(soft).toContain("saturation:-35|lightness:12");
  });

  it("emits no signature without a secret", () => {
    expect(buildStaticMapUrl({ key: KEY })).not.toContain("signature=");
  });

  it("signs exactly the emitted path?query and appends the signature last", () => {
    const secret = "vNIXE0xscrmjlyV-12Nj_BvUPaw=";
    const url = buildStaticMapUrl({ key: KEY, signingSecret: secret });
    const [prefix, signature] = url.split("&signature=");
    expect(signature).toBeTruthy();
    expect(url.endsWith(`&signature=${signature}`)).toBe(true);
    const pathAndQuery = prefix.replace("https://maps.googleapis.com", "");
    expect(signature).toBe(signUrlPath(pathAndQuery, secret));
  });
});

describe("signUrlPath", () => {
  it("matches Google's documented URL-signing example", () => {
    // https://developers.google.com/maps/documentation/maps-static/digital-signature
    expect(
      signUrlPath(
        "/maps/api/geocode/json?address=New+York&client=clientID",
        "vNIXE0xscrmjlyV-12Nj_BvUPaw=",
      ),
    ).toBe("chaRF2hTJKOScPr-RQCEhZbSzIE=");
  });

  it("stays stable for the staticmap regression vector", () => {
    expect(
      signUrlPath("/maps/api/staticmap?size=600x300&scale=2&key=test-key", "aaaaaaaaaaaaaaaaaaaaaaaaaaa="),
    ).toBe("LolGkavJ1tjhT14BbBPf3mNn6vM=");
  });

  it("produces url-safe base64 (no + or /)", () => {
    for (let i = 0; i < 32; i++) {
      const sig = signUrlPath(`/maps/api/staticmap?probe=${i}`, "vNIXE0xscrmjlyV-12Nj_BvUPaw=");
      expect(sig).not.toMatch(/[+/]/);
      // 20-byte SHA1 digest -> 28 base64 chars.
      expect(sig).toHaveLength(28);
    }
  });
});

describe("numberedStopMarkers", () => {
  it("numbers stops 1..9 and cycles the shared palette", () => {
    const points = Array.from({ length: 11 }, (_, i) => ({ lat: i, lng: -i }));
    const markers = numberedStopMarkers(points);
    expect(markers[0]).toMatchObject({ label: "1", color: STATIC_STOP_COLORS[0] });
    expect(markers[8].label).toBe("9");
    expect(markers[9].label).toBeUndefined();
    expect(markers[5].color).toBe(STATIC_STOP_COLORS[5 % STATIC_STOP_COLORS.length]);
  });
});

describe("env-aware helpers", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("browserStaticMapUrl returns null without the browser key", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");
    expect(browserStaticMapUrl({})).toBeNull();
  });

  it("browserStaticMapUrl builds an unsigned URL on the browser key", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "browser-key");
    const url = browserStaticMapUrl({ center: LA, zoom: 13 });
    expect(url).toContain("key=browser-key");
    expect(url).not.toContain("signature=");
  });

  it("signedStaticMapUrl returns null when key or secret is missing", () => {
    vi.stubEnv("STATIC_MAPS_EMAIL_KEY", "email-key");
    vi.stubEnv("STATIC_MAPS_SIGNING_SECRET", "");
    expect(signedStaticMapUrl({})).toBeNull();
    vi.stubEnv("STATIC_MAPS_EMAIL_KEY", "");
    vi.stubEnv("STATIC_MAPS_SIGNING_SECRET", "vNIXE0xscrmjlyV-12Nj_BvUPaw=");
    expect(signedStaticMapUrl({})).toBeNull();
  });

  it("signedStaticMapUrl signs when both env vars are present", () => {
    vi.stubEnv("STATIC_MAPS_EMAIL_KEY", "email-key");
    vi.stubEnv("STATIC_MAPS_SIGNING_SECRET", "vNIXE0xscrmjlyV-12Nj_BvUPaw=");
    const url = signedStaticMapUrl({ center: LA, zoom: 13 });
    expect(url).toContain("signature=");
  });
});
