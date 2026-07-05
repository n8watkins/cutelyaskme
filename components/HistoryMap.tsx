"use client";

import { useEffect, useRef } from "react";
import { htmlEscape as esc } from "@/lib/html";
import { loadGoogleMaps, mapsConfigured, circleMarkerContent, infoHtml, MAP_ID } from "@/lib/google-maps";

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
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!mapsConfigured()) return;

    async function init() {
      const { maps, marker } = await loadGoogleMaps();
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = new maps.Map(containerRef.current, {
        center: { lat: 39.5, lng: -98.35 },
        zoom: 4,
        mapId: MAP_ID,
        gestureHandling: "cooperative",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
      });
      mapRef.current = map;

      if (points.length === 0) return;

      const info = new google.maps.InfoWindow({ maxWidth: 220 });
      const bounds = new google.maps.LatLngBounds();

      points.forEach((p) => {
        const color = STATUS_COLOR[p.status] ?? "#ff7aaa";
        const m = new marker.AdvancedMarkerElement({
          map,
          position: { lat: p.lat, lng: p.lng },
          content: circleMarkerContent(
            `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
          ),
        });
        m.addListener("click", () => {
          info.setContent(infoHtml(`${esc(p.activity)} · ${esc(p.name)}`, esc(p.dateLabel ?? "")));
          info.open({ map, anchor: m });
        });
        bounds.extend({ lat: p.lat, lng: p.lng });
      });

      map.fitBounds(bounds, 50);
    }

    void init();
    return () => {
      cancelled = true;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mapsConfigured()) {
    return (
      <div className="grid h-full w-full place-items-center rounded-[20px] bg-[#fff7fb] text-xs font-black text-[#c0a0b0]">
        Map unavailable — missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full overflow-hidden rounded-[20px]" />;
}
