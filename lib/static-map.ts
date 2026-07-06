// Pure URL builder for the Google Static Maps API - route snapshots for the
// read-only surfaces (past-date reflection, keepsake card, emails).
// https://developers.google.com/maps/documentation/maps-static
//
// Two entry points wrap the builder with env handling:
//  - browserStaticMapUrl(): unsigned, uses the referrer-restricted browser key
//    (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) - fine for <img> tags on our own pages.
//  - signedStaticMapUrl(): HMAC-SHA1 signed via STATIC_MAPS_SIGNING_SECRET -
//    required for email embeds, since email clients send no referrer.
// Both return null when their env vars are missing so callers degrade to
// simply not rendering an image.

import { createHmac } from "crypto";

export const STATIC_MAP_BASE = "https://maps.googleapis.com";
export const STATIC_MAP_PATH = "/maps/api/staticmap";

export type LatLng = { lat: number; lng: number };

export type StaticMapMarker = LatLng & {
  /** Single-character label (A-Z, 0-9). Anything else is dropped - Google rejects longer labels. */
  label?: string;
  /** CSS hex color like "#ff7aaa"; converted to Google's 0x form. */
  color?: string;
  size?: "tiny" | "small" | "mid";
};

export type StaticMapStyle = "minimal" | "soft";

export type StaticMapOptions = {
  key: string;
  /** CSS pixels; rendered at 2x via scale for retina. Defaults 600x300. */
  width?: number;
  height?: number;
  scale?: 1 | 2;
  markers?: StaticMapMarker[];
  /** Polyline through the night's points, drawn when 2+ points are given. */
  path?: LatLng[];
  pathColor?: string;
  /** Address string or coordinates; only needed when there are no markers to auto-fit. */
  center?: string | LatLng;
  zoom?: number;
  style?: StaticMapStyle;
  /** URL signing secret (url-safe base64, from the Google Cloud console). */
  signingSecret?: string;
};

/** Mirrors STOP_COLORS in components/sender/DateMap.tsx - keep the palettes in sync. */
export const STATIC_STOP_COLORS = ["#ff7aaa", "#c7a6ff", "#7acdff", "#ffd6a5", "#a5ffd6"];

const DEFAULT_PATH_COLOR = "#ff7aaa";

// Styled minimal: hide POI/transit clutter so the route reads at a glance.
// "soft" desaturates further for the sentimental keepsake card.
const STYLE_PRESETS: Record<StaticMapStyle, string[]> = {
  minimal: [
    "feature:poi|visibility:off",
    "feature:transit|visibility:off",
    "feature:road|element:labels.icon|visibility:off",
  ],
  soft: [
    "feature:poi|visibility:off",
    "feature:transit|visibility:off",
    "feature:road|element:labels.icon|visibility:off",
    "saturation:-35|lightness:12",
  ],
};

/** "#ff7aaa" → "0xff7aaa" (Google's color syntax; 8 hex digits = RRGGBBAA). */
function googleColor(css: string): string {
  return css.startsWith("#") ? `0x${css.slice(1)}` : css;
}

/** ~1m precision keeps URLs short; Google ignores extra digits anyway. */
function fmtPoint(p: LatLng): string {
  return `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
}

function markerParam(m: StaticMapMarker): string {
  const parts: string[] = [];
  if (m.size) parts.push(`size:${m.size}`);
  parts.push(`color:${googleColor(m.color ?? STATIC_STOP_COLORS[0])}`);
  const label = m.label?.toUpperCase();
  if (label && /^[A-Z0-9]$/.test(label)) parts.push(`label:${label}`);
  parts.push(fmtPoint(m));
  return parts.join("|");
}

/**
 * Sign a `/path?query` string the way Google's URL signing expects:
 * HMAC-SHA1 keyed with the url-safe-base64-decoded secret, output re-encoded
 * as url-safe base64. Matches the documented vector for the geocode example.
 */
export function signUrlPath(pathAndQuery: string, urlSigningSecret: string): string {
  const key = Buffer.from(
    urlSigningSecret.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  );
  return createHmac("sha1", key)
    .update(pathAndQuery)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/** Number stops 1-9 through the shared pin palette; stops past 9 keep a pin but lose the label. */
export function numberedStopMarkers(points: LatLng[]): StaticMapMarker[] {
  return points.map((p, i) => ({
    lat: p.lat,
    lng: p.lng,
    label: i < 9 ? String(i + 1) : undefined,
    color: STATIC_STOP_COLORS[i % STATIC_STOP_COLORS.length],
  }));
}

export function buildStaticMapUrl(o: StaticMapOptions): string {
  const params = new URLSearchParams();
  params.set("size", `${o.width ?? 600}x${o.height ?? 300}`);
  params.set("scale", String(o.scale ?? 2));
  if (o.center !== undefined) {
    params.set("center", typeof o.center === "string" ? o.center : fmtPoint(o.center));
  }
  if (o.zoom !== undefined) params.set("zoom", String(o.zoom));
  for (const m of o.markers ?? []) params.append("markers", markerParam(m));
  if (o.path && o.path.length >= 2) {
    params.append(
      "path",
      [`color:${googleColor(o.pathColor ?? DEFAULT_PATH_COLOR)}`, "weight:3", ...o.path.map(fmtPoint)].join("|"),
    );
  }
  for (const rule of STYLE_PRESETS[o.style ?? "minimal"]) params.append("style", rule);
  params.set("key", o.key);

  let query = params.toString();
  if (o.signingSecret) {
    // Sign exactly the path?query string we emit - Google verifies the URL as received.
    query += `&signature=${signUrlPath(`${STATIC_MAP_PATH}?${query}`, o.signingSecret)}`;
  }
  return `${STATIC_MAP_BASE}${STATIC_MAP_PATH}?${query}`;
}

type EnvlessOptions = Omit<StaticMapOptions, "key" | "signingSecret">;

/**
 * Unsigned URL on the browser key, for <img> tags on our own pages
 * (referrer restrictions protect the key). Null when the key is missing.
 */
export function browserStaticMapUrl(opts: EnvlessOptions): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  return buildStaticMapUrl({ ...opts, key });
}

/**
 * Signed URL for referrer-less contexts (email clients). Needs its own key:
 * a URL signature does NOT bypass application restrictions, so the
 * referrer-restricted browser key always 403s from an email client.
 * STATIC_MAPS_EMAIL_KEY must have no application restriction (API-restricted
 * to Static Maps; the signature + quota cap bound abuse). Null when the key
 * or STATIC_MAPS_SIGNING_SECRET is missing - emails then just skip the map.
 */
export function signedStaticMapUrl(opts: EnvlessOptions): string | null {
  const key = process.env.STATIC_MAPS_EMAIL_KEY;
  const secret = process.env.STATIC_MAPS_SIGNING_SECRET;
  if (!key || !secret) return null;
  return buildStaticMapUrl({ ...opts, key, signingSecret: secret });
}
