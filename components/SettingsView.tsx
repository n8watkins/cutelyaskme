"use client";

import { useEffect, useRef, useState } from "react";
import { CALENDAR_MODE_KEY, type CalendarMode } from "@/lib/calendar";
import {
  MAP_ZOOM_MODE_KEY,
  RADIUS_LIMIT_MIN_MI,
  RADIUS_LIMIT_MAX_MI,
  PLACES_DAILY_CALL_BUDGET,
  type MapZoomMode,
  type UserSettings,
} from "@/lib/settings";

type Usage = { places: number; overpass: number; osrm: number };

/**
 * B4: the interactive part of /settings — search defaults, map zoom mode,
 * calendar export mode, and the C7 Places usage meter. Every change PATCHes
 * /api/settings immediately; mode changes also mirror into the legacy
 * localStorage keys so the planner stays in sync until Task B reads the DB.
 */
export function SettingsView({ initial }: { initial: UserSettings }) {
  const [settings, setSettings] = useState<UserSettings>(initial);
  const [minStr, setMinStr] = useState(String(initial.radiusMinMi));
  const [maxStr, setMaxStr] = useState(String(initial.radiusMaxMi));
  const [boundsError, setBoundsError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  async function commit(patch: Partial<UserSettings>) {
    setStatus("saving");
    setSaveError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json().catch(() => null)) as
        | { settings?: UserSettings; message?: string }
        | null;
      if (!res.ok || !data?.settings) {
        setStatus("error");
        setSaveError(data?.message ?? "Couldn't save. Try again.");
        return;
      }
      const s = data.settings;
      setSettings(s);
      setMinStr(String(s.radiusMinMi));
      setMaxStr(String(s.radiusMaxMi));
      // Mirror only the fields this patch touched — the planner still reads
      // these localStorage keys until Task B wires it to /api/settings.
      try {
        if (patch.mapZoomMode !== undefined) localStorage.setItem(MAP_ZOOM_MODE_KEY, s.mapZoomMode);
        if (patch.calendarMode !== undefined) localStorage.setItem(CALENDAR_MODE_KEY, s.calendarMode);
      } catch {}
      setStatus("saved");
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
      setSaveError("Couldn't save. Try again.");
    }
  }

  function commitBounds() {
    const min = Math.round(Number(minStr));
    const max = Math.round(Number(maxStr));
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      setMinStr(String(settings.radiusMinMi));
      setMaxStr(String(settings.radiusMaxMi));
      return;
    }
    const cMin = Math.min(RADIUS_LIMIT_MAX_MI, Math.max(RADIUS_LIMIT_MIN_MI, min));
    const cMax = Math.min(RADIUS_LIMIT_MAX_MI, Math.max(RADIUS_LIMIT_MIN_MI, max));
    if (cMin >= cMax) {
      setBoundsError("Min must be less than max (within 1–25 mi).");
      setMinStr(String(settings.radiusMinMi));
      setMaxStr(String(settings.radiusMaxMi));
      return;
    }
    setBoundsError(null);
    setMinStr(String(cMin));
    setMaxStr(String(cMax));
    if (cMin === settings.radiusMinMi && cMax === settings.radiusMaxMi) return;
    setSettings((s) => ({ ...s, radiusMinMi: cMin, radiusMaxMi: cMax }));
    void commit({ radiusMinMi: cMin, radiusMaxMi: cMax });
  }

  return (
    <div>
      <p className="mb-6 flex items-center gap-2 text-xs text-[#c0a0b0]">
        Changes save automatically.
        {status === "saving" && <span className="font-black">Saving…</span>}
        {status === "saved" && <span className="font-black text-[#5fa86b]">Saved ✓</span>}
        {status === "error" && saveError && (
          <span className="font-black text-red-500">{saveError}</span>
        )}
      </p>

      {/* Search defaults (B3) */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
          🔍 Search defaults
        </h2>
        <div className="rounded-[20px] border-2 border-[#ffd6e8] bg-white p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-black text-[#8a6a78]">Default search range</span>
            <span className="text-xs font-black text-[#ff7aaa]">{settings.defaultRadiusMi} mi</span>
          </div>
          <input
            type="range"
            min={settings.radiusMinMi}
            max={settings.radiusMaxMi}
            value={settings.defaultRadiusMi}
            aria-label="Default search range in miles"
            onChange={(e) => {
              const v = Number(e.target.value);
              setSettings((s) => ({ ...s, defaultRadiusMi: v }));
            }}
            onPointerUp={(e) => void commit({ defaultRadiusMi: Number(e.currentTarget.value) })}
            onKeyUp={(e) => void commit({ defaultRadiusMi: Number(e.currentTarget.value) })}
            className="w-full accent-[#ff7aaa]"
          />
          <p className="mb-3 text-[10px] text-[#c0a0b0]">
            The planner&apos;s range slider starts here on every new date.
          </p>

          <div className="flex items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-black text-[#8a6a78]">Min (mi)</span>
              <input
                type="number"
                min={RADIUS_LIMIT_MIN_MI}
                max={RADIUS_LIMIT_MAX_MI}
                value={minStr}
                onChange={(e) => setMinStr(e.target.value)}
                onBlur={commitBounds}
                className="w-20 rounded-xl border-2 border-[#ffd6e8] bg-white px-3 py-2 text-sm font-black text-[#3a2530] outline-none focus:border-[#ff7aaa]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-black text-[#8a6a78]">Max (mi)</span>
              <input
                type="number"
                min={RADIUS_LIMIT_MIN_MI}
                max={RADIUS_LIMIT_MAX_MI}
                value={maxStr}
                onChange={(e) => setMaxStr(e.target.value)}
                onBlur={commitBounds}
                className="w-20 rounded-xl border-2 border-[#ffd6e8] bg-white px-3 py-2 text-sm font-black text-[#3a2530] outline-none focus:border-[#ff7aaa]"
              />
            </label>
            <p className="pb-1 text-[10px] text-[#c0a0b0]">
              Slider bounds for venue search radius (max 25 mi).
            </p>
          </div>
          {boundsError && <p className="mt-1 text-xs text-red-500">{boundsError}</p>}
        </div>
      </section>

      {/* Map (A2) */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
          🗺️ Map
        </h2>
        <div className="rounded-[20px] border-2 border-[#ffd6e8] bg-white p-4">
          <p className="mb-2 text-xs font-black text-[#8a6a78]">🖱 Wheel zoom</p>
          <div className="flex gap-2">
            {(["ctrl", "plain"] as const).map((m: MapZoomMode) => (
              <button
                key={m}
                type="button"
                aria-pressed={settings.mapZoomMode === m}
                onClick={() => {
                  setSettings((s) => ({ ...s, mapZoomMode: m }));
                  void commit({ mapZoomMode: m });
                }}
                className={`flex-1 rounded-full border-2 px-3 py-2 text-xs font-black transition ${
                  settings.mapZoomMode === m
                    ? "border-[#ff7aaa] bg-[#ff7aaa] text-white"
                    : "border-[#ffd6e8] text-[#8a6a78] hover:bg-[#fff7fb]"
                }`}
              >
                {m === "ctrl" ? "Ctrl/⌘ + scroll" : "Plain scroll"}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-[#c0a0b0]">
            Ctrl/⌘ + scroll keeps the page scrollable over the map; plain scroll always zooms.
          </p>
        </div>
      </section>

      {/* Calendar (E3) */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
          📅 Calendar
        </h2>
        <div className="rounded-[20px] border-2 border-[#ffd6e8] bg-white p-4">
          <p className="mb-2 text-xs font-black text-[#8a6a78]">Export a date as</p>
          <div className="flex gap-2">
            {(["single", "per-stop"] as const).map((m: CalendarMode) => (
              <button
                key={m}
                type="button"
                aria-pressed={settings.calendarMode === m}
                onClick={() => {
                  setSettings((s) => ({ ...s, calendarMode: m }));
                  void commit({ calendarMode: m });
                }}
                className={`flex-1 rounded-full border-2 px-3 py-2 text-xs font-black transition ${
                  settings.calendarMode === m
                    ? "border-[#ff7aaa] bg-[#ff7aaa] text-white"
                    : "border-[#ffd6e8] text-[#8a6a78] hover:bg-[#fff7fb]"
                }`}
              >
                {m === "single" ? "One event" : "One event per stop"}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-[#c0a0b0]">
            One event spans the whole date; per stop puts each venue at its own time.
          </p>
        </div>
      </section>

      <PlacesUsageMeter />
    </div>
  );
}

/** C7: "Google Places: N calls today" + budget reference, read from /api/usage. */
function PlacesUsageMeter() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/usage")
      .then((res) => (res.ok ? (res.json() as Promise<{ usage: Usage }>) : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.usage) setUsage(data.usage);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const pct = usage ? Math.min(100, (usage.places / PLACES_DAILY_CALL_BUDGET) * 100) : 0;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
        📊 API usage
      </h2>
      <div className="rounded-[20px] border-2 border-[#ffd6e8] bg-white p-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-black text-[#3a2530]">
            {usage ? `Google Places: ${usage.places} ${usage.places === 1 ? "call" : "calls"} today` : failed ? "Google Places: usage unavailable" : "Google Places: loading…"}
          </span>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="rounded-full border-2 border-[#ffd6e8] px-2.5 py-0.5 text-[10px] font-black text-[#8a6a78] transition hover:bg-[#fff7fb]"
          >
            ↻ Refresh
          </button>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#fff0f6]">
          <div
            className="h-full rounded-full bg-[#ff7aaa] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] text-[#c0a0b0]">
          Staying under ~{PLACES_DAILY_CALL_BUDGET} calls/day keeps Google Places free.
          {usage && ` Also today: OpenStreetMap ${usage.overpass} · Routing ${usage.osrm}.`}
        </p>
      </div>
    </section>
  );
}
