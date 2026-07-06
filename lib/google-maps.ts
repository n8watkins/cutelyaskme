// Shared Google Maps JS API loader — one bootstrap for every map component.

import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { htmlEscape } from "@/lib/html";

let configured = false;

/** Map ID is required for AdvancedMarkerElement; DEMO_MAP_ID works fine for default styling. */
export const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

export function mapsConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

/** Load the maps + marker libraries (idempotent). Throws if the key is missing. */
export async function loadGoogleMaps(): Promise<{
  maps: google.maps.MapsLibrary;
  marker: google.maps.MarkerLibrary;
}> {
  if (!configured) {
    setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "", v: "weekly" });
    configured = true;
  }
  const [maps, marker] = await Promise.all([
    importLibrary("maps"),
    importLibrary("marker"),
  ]);
  return { maps, marker };
}

/** A circular div marker matching the app's pin style; used as AdvancedMarker content. */
export function circleMarkerContent(html: string): HTMLDivElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.firstElementChild as HTMLDivElement;
}

/**
 * Popup body shared by all maps. Escapes its arguments itself — venue and
 * waypoint names are third-party data, and making the boundary structural
 * beats hoping every call site remembers to escape.
 */
export function infoHtml(title: string, subtitle?: string, extra?: string): string {
  return `<div style="font-family:Arial,sans-serif;padding:2px 4px">
    <strong style="color:#3a2530">${htmlEscape(title)}</strong>
    ${subtitle ? `<br><span style="color:#8a6a78;font-size:12px">${htmlEscape(subtitle)}</span>` : ""}
    ${extra ? `<br><span style="color:#d32323;font-size:11px;font-weight:900">${htmlEscape(extra)}</span>` : ""}
  </div>`;
}

/**
 * gestureHandling for the wheel-zoom setting. "cooperative" gives the
 * Ctrl+scroll behavior on desktop but forces two-finger pan on touch — so
 * coarse-pointer devices always get "greedy" (one-finger pan, like the
 * pre-migration map).
 */
export function gestureFor(wheelZoomMode?: "ctrl" | "plain"): string {
  if (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) {
    return "greedy";
  }
  return (wheelZoomMode ?? "ctrl") === "plain" ? "greedy" : "cooperative";
}

/** Count one Maps JS load toward the maps-js-loads quota. Fire-and-forget —
 * sendBeacon survives quick navigations; fetch keepalive is the fallback. */
export function reportMapLoad() {
  const body = JSON.stringify({ service: "maps-js-loads" });
  try {
    if (navigator.sendBeacon("/api/usage", new Blob([body], { type: "application/json" }))) {
      return;
    }
  } catch {}
  void fetch("/api/usage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
