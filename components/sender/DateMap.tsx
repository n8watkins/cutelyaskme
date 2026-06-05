"use client";

import { useEffect, useRef } from "react";
import type { MockVenue } from "@/lib/mock-venues";

type DateMapProps = {
  stops: (MockVenue | null)[];
};

// Leaflet needs to be loaded client-side only. We load it dynamically to
// avoid "window is not defined" during SSR.
export function DateMap({ stops }: DateMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);

  useEffect(() => {
    let L: typeof import("leaflet");

    async function init() {
      L = (await import("leaflet")).default;

      // Fix default marker icon path broken by bundlers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (!containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);

      renderStops(L, stops);
    }

    init();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    import("leaflet").then((mod) => renderStops(mod.default, stops));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops]);

  function renderStops(L: typeof import("leaflet"), stops: (MockVenue | null)[]) {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;

    layer.clearLayers();

    const filled = stops.filter(Boolean) as MockVenue[];
    if (!filled.length) {
      map.setView([40.73, -73.99], 13);
      return;
    }

    const colors = ["#ff7aaa", "#c7a6ff", "#7acdff", "#7aff9e", "#ffca7a"];

    filled.forEach((venue, i) => {
      const color = colors[i % colors.length];

      // Custom circle marker with number
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};color:white;display:grid;place-items:center;font-weight:900;font-size:14px;font-family:Arial;box-shadow:0 3px 10px rgba(0,0,0,0.2);border:2px solid white;">${i + 1}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([venue.lat, venue.lng], { icon })
        .addTo(layer)
        .bindPopup(`<strong>${venue.name}</strong><br>${venue.address}<br><em>${venue.note}</em>`);
    });

    // Draw route polyline
    if (filled.length > 1) {
      const latlngs = filled.map((v) => [v.lat, v.lng] as [number, number]);
      L.polyline(latlngs, {
        color: "#ff7aaa",
        weight: 3,
        opacity: 0.6,
        dashArray: "8 6",
      }).addTo(layer);
    }

    // Fit map to markers
    const group = L.featureGroup(
      filled.map((v) => L.marker([v.lat, v.lng])),
    );
    map.fitBounds(group.getBounds().pad(0.3));
  }

  return (
    <>
      {/* Leaflet CSS — loaded once */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <style>{`
        @import url("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
        .leaflet-container { border-radius: 20px; }
      `}</style>
      <div ref={containerRef} className="h-full w-full rounded-[20px]" />
    </>
  );
}
