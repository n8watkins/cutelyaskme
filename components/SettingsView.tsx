"use client";

import { useEffect, useRef, useState } from "react";
import { CALENDAR_MODE_KEY, type CalendarMode } from "@/lib/calendar";
import { capFraction } from "@/lib/api-limits";
import {
  MAP_ZOOM_MODE_KEY,
  RADIUS_LIMIT_MIN_MI,
  RADIUS_LIMIT_MAX_MI,
  type MapZoomMode,
  type UserSettings,
} from "@/lib/settings";

// Shapes returned by GET /api/usage - imported from the route so the
// dashboard can never drift from the API contract.
import type { UsageEntry, PlanUsage } from "@/app/api/usage/route";
type UsageResponse = { usage: UsageEntry[]; plans: PlanUsage[] };

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

      <ApiUsageDashboard />
    </div>
  );
}

/**
 * C7: the full API usage dashboard — one meter per service showing
 * month-to-date against its real monthly free cap plus today's count,
 * and a per-plan breakdown of attributed calls. Reads GET /api/usage.
 */
function ApiUsageDashboard() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/usage?plans=1")
      .then((res) => (res.ok ? (res.json() as Promise<UsageResponse>) : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.usage) setData(d);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Only services a plan actually used become table columns.
  const planColumns =
    data?.usage.filter((u) => data.plans.some((p) => (p.services[u.service] ?? 0) > 0)) ?? [];

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
        📊 API usage
      </h2>
      <div className="rounded-[20px] border-2 border-[#ffd6e8] bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-black text-[#3a2530]">
            {data ? "This month vs each free cap" : failed ? "Usage unavailable" : "Loading usage…"}
          </span>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="rounded-full border-2 border-[#ffd6e8] px-2.5 py-0.5 text-[10px] font-black text-[#8a6a78] transition hover:bg-[#fff7fb]"
          >
            ↻ Refresh
          </button>
        </div>

        {data?.usage.map((u) => <UsageMeterRow key={u.service} entry={u} />)}

        {data && (
          <p className="mt-2 text-[10px] text-[#c0a0b0]">
            Caps are each Google SKU&apos;s monthly free tier; the soft daily budgets keep the
            month on pace.
          </p>
        )}

        {data && data.plans.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-black text-[#8a6a78]">💌 Calls per date plan (this month)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-[9px] uppercase tracking-wider text-[#c0a0b0]">
                    <th className="py-1 pr-2 font-black">Plan</th>
                    {planColumns.map((c) => (
                      <th key={c.service} className="py-1 pr-2 text-right font-black">
                        {c.shortLabel}
                      </th>
                    ))}
                    <th className="py-1 text-right font-black">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.plans.map((p) => (
                    <tr key={p.planId} className="border-t border-[#fff0f6]">
                      <td className="py-1 pr-2 font-black text-[#3a2530]">{p.label}</td>
                      {planColumns.map((c) => (
                        <td key={c.service} className="py-1 pr-2 text-right text-[#8a6a78]">
                          {p.services[c.service] ?? 0}
                        </td>
                      ))}
                      <td className="py-1 text-right font-black text-[#ff7aaa]">{p.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** One service's meter: month-to-date vs its cap, today's count, pace warning. */
function UsageMeterRow({ entry }: { entry: UsageEntry }) {
  const frac =
    capFraction(entry.monthToDate, entry.monthlyCap);
  const nearCap = frac !== null && frac >= 0.8;
  const overPace = entry.dailyBudget !== null && entry.today > entry.dailyBudget;

  return (
    <div className="border-b border-[#fff0f6] py-2 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-black text-[#3a2530]">{entry.label}</span>
        <span className="whitespace-nowrap text-[10px] font-black text-[#8a6a78]">
          {entry.monthlyCap !== null
            ? `${entry.monthToDate.toLocaleString()} / ${entry.monthlyCap.toLocaleString()} mo`
            : `${entry.monthToDate.toLocaleString()} mo`}
          {" · "}
          {entry.today} today
        </span>
      </div>
      {frac !== null && (
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#fff0f6]">
          <div
            className={`h-full rounded-full transition-all ${nearCap ? "bg-[#d32323]" : "bg-[#ff7aaa]"}`}
            style={{ width: `${frac * 100}%` }}
          />
        </div>
      )}
      {overPace && (
        <p className="mt-0.5 text-[10px] font-black text-[#d32323]">
          ⚠ Over the ~{entry.dailyBudget}/day soft budget.
        </p>
      )}
    </div>
  );
}
