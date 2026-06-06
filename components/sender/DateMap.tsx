"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Venue } from "@/lib/venues";

type DateMapProps = {
  stops: (Venue | null)[];
  /** When provided, shows a draggable pin + radius circle for search-area selection */
  pinMode?: boolean;
  searchRadius?: number; // meters
  onCenterChange?: (lat: number, lng: number) => void;
  /** Fly map to this position when it changes (e.g. after zip code entry) */
  viewCenter?: { lat: number; lng: number } | null;
};

const STOP_COLORS = ["#ff7aaa", "#c7a6ff", "#7acdff", "#ffd6a5", "#a5ffd6"];

export function DateMap({ stops, pinMode, searchRadius, onCenterChange, viewCenter }: DateMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const stopsLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const pinLayerRef = useRef<import("leaflet").LayerGroup | null>(null);

  const renderStops = useCallback((L: typeof import("leaflet"), currentStops: (Venue | null)[]) => {
    const layer = stopsLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;

    layer.clearLayers();
    const filled = currentStops.filter(Boolean) as Venue[];

    if (!filled.length) {
      map.setView([40.73, -73.99], 13);
      return;
    }

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
            <strong style="color:#3a2530">${venue.name}</strong><br>
            <span style="color:#8a6a78;font-size:12px">${venue.address}</span>
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
      .bindTooltip("Drag to set search area", { direction: "top", offset: [0, -22], permanent: false });

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
    async function init() {
      const L = (await import("leaflet")).default;
      if (!containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        zoomAnimation: true,
      });

      // CartoDB Positron — clean, minimal, romantic-neutral
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      mapRef.current = map;
      stopsLayerRef.current = L.layerGroup().addTo(map);
      pinLayerRef.current = L.layerGroup().addTo(map);

      renderStops(L, stops);
    }

    void init();

    return () => {
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
      <div ref={containerRef} className="h-full w-full rounded-[20px]" />
    </>
  );
}
