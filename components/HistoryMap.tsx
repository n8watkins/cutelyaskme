"use client";

import { useEffect, useRef } from "react";
import { htmlEscape as esc } from "@/lib/html";

export type HistoryPoint = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  dateLabel: string | null;
  activity: string;
  status: "liked" | "disliked" | "neutral";
};

const STATUS_COLOR: Record<string, string> = {
  liked: "#5fd97f",
  disliked: "#d32323",
  neutral: "#ff7aaa",
};

export function HistoryMap({ points }: { points: HistoryPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);
      mapRef.current = map;

      if (points.length === 0) {
        map.setView([39.5, -98.35], 4);
        return;
      }

      const markers = points.map((p) => {
        const color = STATUS_COLOR[p.status] ?? "#ff7aaa";
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        return L.marker([p.lat, p.lng], { icon }).bindPopup(
          `<div style="font-family:Arial,sans-serif">
            <strong style="color:#3a2530">${esc(p.activity)} · ${esc(p.name)}</strong><br>
            <span style="color:#8a6a78;font-size:12px">${esc(p.dateLabel ?? "")}</span>
          </div>`,
          { maxWidth: 220 },
        );
      });

      const group = L.featureGroup(markers).addTo(map);
      map.fitBounds(group.getBounds().pad(0.3));
    }

    void init();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <style>{`
        @import url("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
        .leaflet-container { border-radius: 20px; font-family: Arial, sans-serif; }
        .leaflet-popup-tip-container { display: none; }
      `}</style>
      <div ref={containerRef} className="h-full w-full rounded-[20px]" />
    </>
  );
}
