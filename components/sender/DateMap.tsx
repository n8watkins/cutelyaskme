"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Venue } from "@/lib/venues";
import { htmlEscape as esc } from "@/lib/html";
import { loadGoogleMaps, mapsConfigured, circleMarkerContent, infoHtml, MAP_ID } from "@/lib/google-maps";

type DateMapProps = {
  stops: (Venue | null)[];
  /** When provided, shows a draggable pin + radius circle for search-area selection */
  pinMode?: boolean;
  searchRadius?: number; // meters
  onCenterChange?: (lat: number, lng: number) => void;
  /** Fly map to this position when it changes (e.g. after zip code entry) */
  viewCenter?: { lat: number; lng: number } | null;
  /** Recommendation pins for the focused stop (red markers) */
  candidates?: Venue[];
  selectedId?: string | null;
  onCandidateSelect?: (venue: Venue) => void;
  /** Start / pickup waypoints (your place, date's place) */
  waypoints?: { id: string; label: string; lat: number; lng: number; kind: "start" | "pickup" }[];
  /** "ctrl" (default) = Ctrl/⌘+scroll zooms (cooperative), "plain" = scroll always zooms (greedy) */
  wheelZoomMode?: "ctrl" | "plain";
  /** A5: when set, the next map click is a placement — shows "click to place {pickLabel}" + crosshair */
  pickLabel?: string | null;
  onMapPick?: (lat: number, lng: number) => void;
};

const STOP_COLORS = ["#ff7aaa", "#c7a6ff", "#7acdff", "#ffd6a5", "#a5ffd6"];

/** Count one Maps JS load toward the maps-js-loads quota. Fire-and-forget —
 * sendBeacon survives quick navigations; fetch keepalive is the fallback. */
function reportMapLoad() {
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

type Marker = google.maps.marker.AdvancedMarkerElement;

/** fitBounds with one point dives to street level — pull back once it settles. */
function clampZoom(map: google.maps.Map, max: number) {
  google.maps.event.addListenerOnce(map, "idle", () => {
    const z = map.getZoom();
    if (z !== undefined && z > max) map.setZoom(max);
  });
}

/** Glide to a zoom level one step at a time instead of snapping. */
function smoothZoomTo(map: google.maps.Map, target: number, stepMs = 160): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const step = () => {
    const z = map.getZoom();
    if (z === undefined || z === target) return;
    map.setZoom(z + (z < target ? 1 : -1));
    timer = setTimeout(step, stepMs);
  };
  step();
  return () => {
    if (timer) clearTimeout(timer);
  };
}

export function DateMap({
  stops,
  pinMode,
  searchRadius,
  onCenterChange,
  viewCenter,
  candidates,
  selectedId,
  onCandidateSelect,
  waypoints,
  wheelZoomMode,
  pickLabel,
  onMapPick,
}: DateMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerLibRef = useRef<google.maps.MarkerLibrary | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // Marker/overlay groups, cleared independently.
  const stopMarkersRef = useRef<Marker[]>([]);
  const stopLineRef = useRef<google.maps.Polyline | null>(null);
  const candidateMarkersRef = useRef<Marker[]>([]);
  const waypointMarkersRef = useRef<Marker[]>([]);
  const pinMarkerRef = useRef<Marker | null>(null);
  const pinCircleRef = useRef<google.maps.Circle | null>(null);

  const onCandidateSelectRef = useRef(onCandidateSelect);
  useEffect(() => {
    onCandidateSelectRef.current = onCandidateSelect;
  }, [onCandidateSelect]);

  // Map-click behavior (A5): pick mode wins, then pin-mode click-to-set-center.
  const onMapPickRef = useRef(onMapPick);
  const pickActiveRef = useRef(!!pickLabel);
  const pinModeRef = useRef(!!pinMode);
  const onCenterChangeRef = useRef(onCenterChange);
  useEffect(() => {
    onMapPickRef.current = onMapPick;
    pickActiveRef.current = !!pickLabel;
    pinModeRef.current = !!pinMode;
    onCenterChangeRef.current = onCenterChange;
    // Crosshair while picking (A5)
    mapRef.current?.setOptions({ draggableCursor: pickLabel ? "crosshair" : null });
  }, [onMapPick, pickLabel, pinMode, onCenterChange]);

  // Wheel-zoom mode (A2): Google's gestureHandling matches the two modes exactly —
  // "cooperative" shows its own "use Ctrl + scroll" hint, so no custom overlay needed.
  useEffect(() => {
    mapRef.current?.setOptions({
      gestureHandling: (wheelZoomMode ?? "ctrl") === "plain" ? "greedy" : "cooperative",
    });
  }, [wheelZoomMode]);

  const openInfo = useCallback((marker: Marker, html: string) => {
    const map = mapRef.current;
    if (!map) return;
    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow({ maxWidth: 220 });
    }
    infoWindowRef.current.setContent(html);
    infoWindowRef.current.open({ map, anchor: marker });
  }, []);

  const renderStops = useCallback((currentStops: (Venue | null)[]) => {
    const map = mapRef.current;
    const markerLib = markerLibRef.current;
    if (!map || !markerLib) return;

    stopMarkersRef.current.forEach((m) => (m.map = null));
    stopMarkersRef.current = [];
    stopLineRef.current?.setMap(null);
    stopLineRef.current = null;

    const filled = currentStops.filter(Boolean) as Venue[];

    // No stops → stay where we are (search center / last view). Never jump to a
    // hardcoded city.
    if (!filled.length) return;

    filled.forEach((venue, i) => {
      const color = STOP_COLORS[i % STOP_COLORS.length];
      const marker = new markerLib.AdvancedMarkerElement({
        map,
        position: { lat: venue.lat, lng: venue.lng },
        zIndex: 100,
        content: circleMarkerContent(`<div style="
          width:34px;height:34px;border-radius:50%;
          background:${color};color:white;
          display:grid;place-items:center;
          font-weight:900;font-size:14px;font-family:Arial,sans-serif;
          box-shadow:0 4px 12px rgba(0,0,0,0.18);border:2.5px solid white;
        ">${i + 1}</div>`),
      });
      marker.addListener("click", () => openInfo(marker, infoHtml(esc(venue.name), esc(venue.address))));
      stopMarkersRef.current.push(marker);
    });

    if (filled.length > 1) {
      // Dashed route line — Google has no dashArray; a repeated dash symbol does it.
      stopLineRef.current = new google.maps.Polyline({
        map,
        path: filled.map((v) => ({ lat: v.lat, lng: v.lng })),
        strokeOpacity: 0,
        icons: [{
          icon: { path: "M 0,-1 0,1", strokeOpacity: 0.5, strokeColor: "#ff7aaa", strokeWeight: 3, scale: 3 },
          offset: "0",
          repeat: "14px",
        }],
      });
    }

    const bounds = new google.maps.LatLngBounds();
    filled.forEach((v) => bounds.extend({ lat: v.lat, lng: v.lng }));
    map.fitBounds(bounds, 70);
    clampZoom(map, 16); // one stop → fitBounds dives to street level; keep context
  }, [openInfo]);

  const renderCandidates = useCallback((cands: Venue[], selId: string | null | undefined) => {
    const map = mapRef.current;
    const markerLib = markerLibRef.current;
    if (!map || !markerLib) return;

    candidateMarkersRef.current.forEach((m) => (m.map = null));
    candidateMarkersRef.current = [];

    cands.forEach((v) => {
      const isSel = v.id === selId;
      const size = isSel ? 20 : 14;
      // Dot + always-visible name chip, so you can tell which dot is which
      // without clicking every pin.
      const marker = new markerLib.AdvancedMarkerElement({
        map,
        position: { lat: v.lat, lng: v.lng },
        zIndex: isSel ? 30 : 10, // below the numbered stop pins
        content: circleMarkerContent(`<div style="display:grid;justify-items:center;gap:3px">
          <div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:#d32323;border:2.5px solid white;
            box-shadow:0 2px 7px rgba(0,0,0,0.35);
            ${isSel ? "outline:2px solid #d32323;outline-offset:2px;" : ""}
          "></div>
          <span style="
            max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
            background:${isSel ? "#d32323" : "rgba(255,255,255,0.92)"};
            color:${isSel ? "white" : "#3a2530"};
            border:1px solid ${isSel ? "#d32323" : "#ffd6e8"};
            border-radius:8px;padding:1px 6px;
            font-family:Arial,sans-serif;font-size:10px;font-weight:900;
            box-shadow:0 1px 4px rgba(0,0,0,0.15);
          ">${esc(v.name)}</span>
        </div>`),
      });
      marker.addListener("click", () => {
        openInfo(marker, infoHtml(esc(v.name), esc(v.address), "tap pin to pick"));
        onCandidateSelectRef.current?.(v);
      });
      candidateMarkersRef.current.push(marker);
    });
  }, [openInfo]);

  const renderWaypoints = useCallback((wps: NonNullable<DateMapProps["waypoints"]>) => {
    const map = mapRef.current;
    const markerLib = markerLibRef.current;
    if (!map || !markerLib) return;

    waypointMarkersRef.current.forEach((m) => (m.map = null));
    waypointMarkersRef.current = [];

    wps.forEach((w) => {
      const emoji = w.kind === "start" ? "🏠" : "💕";
      const bg = w.kind === "start" ? "#3a2530" : "#ff7aaa";
      const marker = new markerLib.AdvancedMarkerElement({
        map,
        position: { lat: w.lat, lng: w.lng },
        zIndex: 50,
        content: circleMarkerContent(`<div style="
          width:32px;height:32px;border-radius:50%;
          background:${bg};display:grid;place-items:center;font-size:15px;
          box-shadow:0 4px 12px rgba(0,0,0,0.25);border:2.5px solid white;
        ">${emoji}</div>`),
      });
      marker.addListener("click", () =>
        openInfo(marker, infoHtml(`${w.kind === "start" ? "Start" : "Pickup"} · ${esc(w.label)}`)),
      );
      waypointMarkersRef.current.push(marker);
    });
  }, [openInfo]);

  const clearPin = useCallback(() => {
    if (pinMarkerRef.current) pinMarkerRef.current.map = null;
    pinMarkerRef.current = null;
    pinCircleRef.current?.setMap(null);
    pinCircleRef.current = null;
  }, []);

  const renderPin = useCallback(() => {
    const map = mapRef.current;
    const markerLib = markerLibRef.current;
    if (!map || !markerLib) return;

    clearPin();
    const center = map.getCenter();
    if (!center) return;

    const content = circleMarkerContent(`<div title="Drag — or click the map — to set search area" style="
      width:38px;height:38px;border-radius:50%;
      background:#3a2530;color:white;
      display:grid;place-items:center;font-size:19px;
      box-shadow:0 4px 16px rgba(0,0,0,0.28);border:2.5px solid white;
      cursor:grab;user-select:none;
    ">📍</div>`);

    const pin = new markerLib.AdvancedMarkerElement({
      map,
      position: center,
      gmpDraggable: true,
      zIndex: 200,
      content,
    });
    pinMarkerRef.current = pin;

    const circle = new google.maps.Circle({
      map,
      center,
      radius: searchRadius ?? 8000,
      strokeColor: "#ff7aaa",
      strokeWeight: 2,
      strokeOpacity: 0.5,
      fillColor: "#ff7aaa",
      fillOpacity: 0.07,
      clickable: false,
    });
    pinCircleRef.current = circle;

    pin.addListener("drag", () => {
      if (pin.position) circle.setCenter(pin.position);
    });
    pin.addListener("dragend", () => {
      const pos = pin.position;
      if (!pos) return;
      circle.setCenter(pos);
      const lat = typeof pos.lat === "function" ? pos.lat() : pos.lat;
      const lng = typeof pos.lng === "function" ? pos.lng() : pos.lng;
      onCenterChangeRef.current?.(lat, lng);
    });
  }, [searchRadius, clearPin]);

  // Init map once
  useEffect(() => {
    let cancelled = false;
    if (!mapsConfigured()) return;

    async function init() {
      const { maps, marker } = await loadGoogleMaps();
      if (cancelled || !containerRef.current || mapRef.current) return;

      // Initial view (A4): search center → first waypoint → the user's own
      // location (browser geolocation) → neutral US overview.
      const wp = waypoints?.[0];
      const initial = viewCenter
        ? { center: viewCenter, zoom: 13 }
        : wp
          ? { center: { lat: wp.lat, lng: wp.lng }, zoom: 12 }
          : { center: { lat: 39.5, lng: -98.35 }, zoom: 4 };
      if (!viewCenter && !wp && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            // Don't fight a zip/city entry that landed while we waited.
            if (cancelled || !mapRef.current || mapRef.current.getZoom() !== 4) return;
            mapRef.current.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            smoothZoomTo(mapRef.current, 11);
          },
          () => {}, // denied/unavailable → stay on the US overview
          { maximumAge: 600000, timeout: 5000 },
        );
      }

      const map = new maps.Map(containerRef.current, {
        ...initial,
        mapId: MAP_ID,
        gestureHandling: (wheelZoomMode ?? "ctrl") === "plain" ? "greedy" : "cooperative",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false, // Google POI pins would fight our candidate pins
      });

      // A5: clicks place a custom pin (pick mode) or move the search center
      // (pin mode). Refs keep the behavior current without re-binding.
      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        if (pickActiveRef.current) {
          onMapPickRef.current?.(lat, lng);
        } else if (pinModeRef.current) {
          if (pinMarkerRef.current) pinMarkerRef.current.position = { lat, lng };
          pinCircleRef.current?.setCenter({ lat, lng });
          onCenterChangeRef.current?.(lat, lng);
        }
      });

      mapRef.current = map;
      markerLibRef.current = marker;
      reportMapLoad();
      renderStops(stops);
      renderCandidates(candidates ?? [], selectedId);
      renderWaypoints(waypoints ?? []);
      if (pinMode) renderPin();
    }

    void init();
    return () => {
      cancelled = true;
      mapRef.current = null;
      markerLibRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render stop markers when stops change
  useEffect(() => {
    renderStops(stops);
  }, [stops, renderStops]);

  // Re-render recommendation pins when the focused stop's candidates change
  useEffect(() => {
    renderCandidates(candidates ?? [], selectedId);
  }, [candidates, selectedId, renderCandidates]);

  // Re-render start/pickup waypoints when they change
  useEffect(() => {
    renderWaypoints(waypoints ?? []);
  }, [waypoints, renderWaypoints]);

  // Fly to location when zip/city changes — pan, then ease the zoom in steps
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !viewCenter) return;
    map.panTo(viewCenter);
    return smoothZoomTo(map, 13);
  }, [viewCenter]);

  // Manage pin mode overlays
  useEffect(() => {
    if (!mapRef.current) return;
    if (pinMode) renderPin();
    else clearPin();
  }, [pinMode, searchRadius, renderPin, clearPin]);

  if (!mapsConfigured()) {
    return (
      <div className="grid h-full w-full place-items-center rounded-[20px] bg-[#fff7fb] text-xs font-black text-[#c0a0b0]">
        Map unavailable — missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full overflow-hidden rounded-[20px]" />
      {/* A5: placement banner */}
      {pickLabel && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2">
          <span className="rounded-full bg-[#3a2530] px-4 py-1.5 text-xs font-black text-white shadow-lg">
            📍 Click the map to place {pickLabel}
          </span>
        </div>
      )}
    </div>
  );
}
