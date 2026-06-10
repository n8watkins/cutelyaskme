"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Venue } from "@/lib/venues";
import { htmlEscape as esc } from "@/lib/html";

type DateMapProps = {
  stops: (Venue | null)[];
  /** When provided, shows a draggable pin + radius circle for search-area selection */
  pinMode?: boolean;
  searchRadius?: number; // meters
  onCenterChange?: (lat: number, lng: number) => void;
  /** Fly map to this position when it changes (e.g. after zip code entry) */
  viewCenter?: { lat: number; lng: number } | null;
  /** Recommendation pins for the focused stop (red Yelp-style markers) */
  candidates?: Venue[];
  selectedId?: string | null;
  onCandidateSelect?: (venue: Venue) => void;
  /** Start / pickup waypoints (your place, date's place) */
  waypoints?: { id: string; label: string; lat: number; lng: number; kind: "start" | "pickup" }[];
  /** "ctrl" (default) = Ctrl/⌘+scroll zooms, plain scroll passes through; "plain" = scroll always zooms */
  wheelZoomMode?: "ctrl" | "plain";
  /** A5: when set, the next map click is a placement — shows "click to place {pickLabel}" + crosshair */
  pickLabel?: string | null;
  onMapPick?: (lat: number, lng: number) => void;
};

const STOP_COLORS = ["#ff7aaa", "#c7a6ff", "#7acdff", "#ffd6a5", "#a5ffd6"];

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
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const stopsLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const pinLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const candidatesLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const waypointsLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const onCandidateSelectRef = useRef(onCandidateSelect);
  useEffect(() => {
    onCandidateSelectRef.current = onCandidateSelect;
  }, [onCandidateSelect]);

  // Map-click behavior (A5): pick mode wins, then pin-mode click-to-set-center.
  const onMapPickRef = useRef(onMapPick);
  const pickActiveRef = useRef(!!pickLabel);
  const pinModeRef = useRef(!!pinMode);
  const onCenterChangeRef = useRef(onCenterChange);
  // The draggable search pin + circle, so a click can move them too.
  const pinMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const pinCircleRef = useRef<import("leaflet").Circle | null>(null);
  useEffect(() => {
    onMapPickRef.current = onMapPick;
    pickActiveRef.current = !!pickLabel;
    pinModeRef.current = !!pinMode;
    onCenterChangeRef.current = onCenterChange;
  }, [onMapPick, pickLabel, pinMode, onCenterChange]);

  // Wheel-zoom mode (A2): "ctrl" = Google-Maps-style modifier zoom + hint overlay.
  const wheelModeRef = useRef<"ctrl" | "plain">(wheelZoomMode ?? "ctrl");
  const lastWheelZoomRef = useRef(0);
  const [showZoomHint, setShowZoomHint] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    wheelModeRef.current = wheelZoomMode ?? "ctrl";
    const map = mapRef.current;
    if (!map) return;
    if (wheelModeRef.current === "plain") map.scrollWheelZoom.enable();
    else map.scrollWheelZoom.disable();
  }, [wheelZoomMode]);

  const renderStops = useCallback((L: typeof import("leaflet"), currentStops: (Venue | null)[]) => {
    const layer = stopsLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;

    layer.clearLayers();
    const filled = currentStops.filter(Boolean) as Venue[];

    // No stops → stay where we are (search center / last view). Never jump to a
    // hardcoded city (the old [40.73, -73.99] NYC fallback yanked the map away
    // from the search area on deselect).
    if (!filled.length) return;

    filled.forEach((venue, i) => {
      const color = STOP_COLORS[i % STOP_COLORS.length];
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:34px;height:34px;border-radius:50%;
          background:${color};color:white;
          display:grid;place-items:center;
          font-weight:900;font-size:14px;font-family:Arial,sans-serif;
          box-shadow:0 4px 12px rgba(0,0,0,0.18);border:2.5px solid white;
        ">${i + 1}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      L.marker([venue.lat, venue.lng], { icon })
        .addTo(layer)
        .bindPopup(
          `<div style="font-family:Arial,sans-serif">
            <strong style="color:#3a2530">${esc(venue.name)}</strong><br>
            <span style="color:#8a6a78;font-size:12px">${esc(venue.address)}</span>
          </div>`,
          { maxWidth: 220 },
        );
    });

    if (filled.length > 1) {
      L.polyline(
        filled.map((v) => [v.lat, v.lng] as [number, number]),
        { color: "#ff7aaa", weight: 3, opacity: 0.5, dashArray: "8 6" },
      ).addTo(layer);
    }

    const group = L.featureGroup(filled.map((v) => L.marker([v.lat, v.lng])));
    map.fitBounds(group.getBounds().pad(0.35));
  }, []);

  const renderCandidates = useCallback(
    (L: typeof import("leaflet"), cands: Venue[], selId: string | null | undefined) => {
      const layer = candidatesLayerRef.current;
      if (!layer) return;
      layer.clearLayers();

      cands.forEach((v) => {
        const isSel = v.id === selId;
        const size = isSel ? 20 : 14;
        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:#d32323;border:2.5px solid white;
            box-shadow:0 2px 7px rgba(0,0,0,0.35);
            ${isSel ? "outline:2px solid #d32323;outline-offset:2px;" : ""}
          "></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        L.marker([v.lat, v.lng], { icon, zIndexOffset: -200 })
          .addTo(layer)
          .bindPopup(
            `<div style="font-family:Arial,sans-serif">
              <strong style="color:#3a2530">${esc(v.name)}</strong><br>
              <span style="color:#8a6a78;font-size:12px">${esc(v.address)}</span><br>
              <span style="color:#d32323;font-size:11px;font-weight:900">tap pin to pick</span>
            </div>`,
            { maxWidth: 200 },
          )
          .on("click", () => onCandidateSelectRef.current?.(v));
      });
    },
    [],
  );

  const renderWaypoints = useCallback(
    (L: typeof import("leaflet"), wps: NonNullable<DateMapProps["waypoints"]>) => {
      const layer = waypointsLayerRef.current;
      if (!layer) return;
      layer.clearLayers();

      wps.forEach((w) => {
        const emoji = w.kind === "start" ? "🏠" : "💕";
        const bg = w.kind === "start" ? "#3a2530" : "#ff7aaa";
        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:32px;height:32px;border-radius:50%;
            background:${bg};display:grid;place-items:center;font-size:15px;
            box-shadow:0 4px 12px rgba(0,0,0,0.25);border:2.5px solid white;
          ">${emoji}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        L.marker([w.lat, w.lng], { icon })
          .addTo(layer)
          .bindPopup(
            `<div style="font-family:Arial,sans-serif"><strong style="color:#3a2530">${
              w.kind === "start" ? "Start" : "Pickup"
            } · ${esc(w.label)}</strong></div>`,
            { maxWidth: 200 },
          );
      });
    },
    [],
  );

  const renderPin = useCallback((L: typeof import("leaflet")) => {
    const layer = pinLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;

    layer.clearLayers();

    const center = map.getCenter();

    // Draggable search-center pin
    const pinIcon = L.divIcon({
      className: "",
      html: `<div style="
        width:38px;height:38px;border-radius:50%;
        background:#3a2530;color:white;
        display:grid;place-items:center;font-size:19px;
        box-shadow:0 4px 16px rgba(0,0,0,0.28);border:2.5px solid white;
        cursor:grab;user-select:none;
      ">📍</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    const pin = L.marker([center.lat, center.lng], { icon: pinIcon, draggable: true })
      .addTo(layer)
      .bindTooltip("Drag — or click the map — to set search area", { direction: "top", offset: [0, -22], permanent: false });
    pinMarkerRef.current = pin;

    // Radius circle (updates as pin drags)
    const circle = L.circle([center.lat, center.lng], {
      radius: searchRadius ?? 8000,
      color: "#ff7aaa",
      weight: 2,
      opacity: 0.5,
      fillColor: "#ff7aaa",
      fillOpacity: 0.07,
      dashArray: "7 5",
    }).addTo(layer);
    pinCircleRef.current = circle;

    pin.on("drag", () => {
      const { lat, lng } = pin.getLatLng();
      circle.setLatLng([lat, lng]);
    });

    pin.on("dragend", () => {
      const { lat, lng } = pin.getLatLng();
      circle.setLatLng([lat, lng]);
      onCenterChange?.(lat, lng);
    });
  }, [searchRadius, onCenterChange]);

  // Init map once
  useEffect(() => {
    let wheelCleanup: (() => void) | null = null;

    async function init() {
      const L = (await import("leaflet")).default;
      if (!containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        // Wheel zoom is mode-dependent (A2): Leaflet's own handler only for
        // "plain"; "ctrl" mode uses the custom listener below.
        scrollWheelZoom: wheelModeRef.current === "plain",
        zoomAnimation: true,
        // Mobile: pinch-to-zoom + drag explicitly on.
        touchZoom: true,
        dragging: true,
      });

      // Initial view (A4): search center → first waypoint → neutral US overview.
      // Never a hardcoded city.
      const wp = waypoints?.[0];
      if (viewCenter) map.setView([viewCenter.lat, viewCenter.lng], 13);
      else if (wp) map.setView([wp.lat, wp.lng], 12);
      else map.setView([39.5, -98.35], 4);

      // Ctrl/⌘+scroll zoom + "hold Ctrl" hint when plain-scrolling in ctrl mode.
      const onWheel = (e: WheelEvent) => {
        if (wheelModeRef.current !== "ctrl") return; // plain mode → Leaflet handles it
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault(); // also stops browser page-zoom
          const now = Date.now();
          if (now - lastWheelZoomRef.current < 80) return;
          lastWheelZoomRef.current = now;
          const point = map.mouseEventToContainerPoint(e);
          map.setZoomAround(point, map.getZoom() + (e.deltaY < 0 ? 1 : -1));
        } else {
          setShowZoomHint(true);
          if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
          hintTimerRef.current = setTimeout(() => setShowZoomHint(false), 1400);
        }
      };
      const wheelTarget = containerRef.current;
      wheelTarget.addEventListener("wheel", onWheel, { passive: false });
      wheelCleanup = () => wheelTarget.removeEventListener("wheel", onWheel);

      // A5: clicks place a custom pin (pick mode) or move the search center
      // (pin mode). Refs keep the behavior current without re-binding.
      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        if (pickActiveRef.current) {
          onMapPickRef.current?.(e.latlng.lat, e.latlng.lng);
        } else if (pinModeRef.current) {
          pinMarkerRef.current?.setLatLng(e.latlng);
          pinCircleRef.current?.setLatLng(e.latlng);
          onCenterChangeRef.current?.(e.latlng.lat, e.latlng.lng);
        }
      });

      // CartoDB Positron — clean, minimal, romantic-neutral
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      mapRef.current = map;
      candidatesLayerRef.current = L.layerGroup().addTo(map); // below the numbered stop pins
      stopsLayerRef.current = L.layerGroup().addTo(map);
      waypointsLayerRef.current = L.layerGroup().addTo(map);
      pinLayerRef.current = L.layerGroup().addTo(map);

      renderStops(L, stops);
    }

    void init();

    return () => {
      wheelCleanup?.();
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render stop markers when stops change
  useEffect(() => {
    if (!mapRef.current) return;
    void import("leaflet").then((mod) => renderStops(mod.default, stops));
  }, [stops, renderStops]);

  // Re-render recommendation pins when the focused stop's candidates change
  useEffect(() => {
    if (!mapRef.current) return;
    void import("leaflet").then((mod) => renderCandidates(mod.default, candidates ?? [], selectedId));
  }, [candidates, selectedId, renderCandidates]);

  // Re-render start/pickup waypoints when they change
  useEffect(() => {
    if (!mapRef.current) return;
    void import("leaflet").then((mod) => renderWaypoints(mod.default, waypoints ?? []));
  }, [waypoints, renderWaypoints]);

  // Fly to location when zip/city changes
  useEffect(() => {
    if (!mapRef.current || !viewCenter) return;
    mapRef.current.flyTo([viewCenter.lat, viewCenter.lng], 13, { animate: true, duration: 0.8 });
  }, [viewCenter]);

  // Manage pin mode layer
  useEffect(() => {
    if (!mapRef.current) return;
    void import("leaflet").then((mod) => {
      if (pinMode) renderPin(mod.default);
      else pinLayerRef.current?.clearLayers();
    });
  }, [pinMode, searchRadius, renderPin]);

  return (
    <>
      {/* Leaflet CSS */}
      <style>{`
        @import url("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
        .leaflet-container { border-radius: 20px; font-family: Arial, sans-serif; }
        .leaflet-popup-content-wrapper {
          border-radius: 14px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.10);
          border: 1.5px solid #ffd6e8;
        }
        .leaflet-popup-tip-container { display: none; }
        .leaflet-control-zoom a {
          border-radius: 10px !important;
          font-weight: 900 !important;
          color: #3a2530 !important;
        }
        .leaflet-tooltip {
          border-radius: 10px;
          border: none;
          background: #3a2530;
          color: white;
          font-weight: 900;
          font-size: 11px;
          padding: 4px 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .leaflet-tooltip-top::before { border-top-color: #3a2530; }
      `}</style>
      <div className={`relative h-full w-full ${pickLabel ? "map-pick-mode" : ""}`}>
        {pickLabel && (
          <style>{`.map-pick-mode .leaflet-container { cursor: crosshair !important; }`}</style>
        )}
        <div ref={containerRef} className="h-full w-full rounded-[20px]" />
        {/* A5: placement banner */}
        {pickLabel && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2">
            <span className="rounded-full bg-[#3a2530] px-4 py-1.5 text-xs font-black text-white shadow-lg">
              📍 Click the map to place {pickLabel}
            </span>
          </div>
        )}
        {/* "Hold Ctrl to zoom" hint (A2 ctrl mode) — pointer-events-none so it never blocks the map */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 z-[1000] grid place-items-center rounded-[20px] bg-[#3a2530]/40 transition-opacity duration-300 ${
            showZoomHint ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#3a2530] shadow-lg">
            Hold Ctrl / ⌘ + scroll to zoom
          </span>
        </div>
      </div>
    </>
  );
}
