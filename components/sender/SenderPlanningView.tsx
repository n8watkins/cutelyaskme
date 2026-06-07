"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import SunCalc from "suncalc";
import { parseTimeToMinutes, formatTime, formatDuration } from "@/lib/datetime";
import { buildItineraryText, icsEscape, buildGCalLink } from "@/lib/calendar";
import { sunWarning } from "@/lib/sun";
import type { SavedAddress } from "@/components/SavedAddresses";

type Waypoint = { label: string; lat: number; lng: number };
import type { Venue } from "@/lib/venues";
import {
  ACTIVITY_ICONS,
  ACTIVITY_PLACE_QUERY,
  DEFAULT_STOP_DURATIONS,
  NATURAL_PLACE_ACTIVITIES,
  NO_VENUE_ACTIVITIES,
  PRICE_LABELS,
} from "@/lib/venues";

const DateMap = dynamic(
  () => import("./DateMap").then((m) => m.DateMap),
  { ssr: false, loading: () => <div className="h-full w-full rounded-[20px] bg-[#ffd6e8]/30 animate-pulse" /> },
);

const DRESS_VIBE_LABELS: Record<string, string> = {
  casual: "🧢 Keep it casual",
  "casual-cute": "🌸 Casual but cute",
  "dress-up": "👗 Ready to dress up",
  "match-you": "✨ Match whatever",
};

const DURATION_OPTIONS = [
  { label: "30m", value: 30 },
  { label: "45m", value: 45 },
  { label: "1h", value: 60 },
  { label: "1.5h", value: 90 },
  { label: "2h", value: 120 },
  { label: "3h", value: 180 },
];

const ENTREE_KEY = "__entree__";
const PAGE_SIZE = 5;

type PlanData = {
  selectedDate: string | null;
  selectedDateLabel: string | null;
  selectedTime: string | null;
  selectedTimeLabel: string | null;
  selectedEntree: string | null;
  selectedActivities: string[];
  dressVibe: string | null;
  recipientName: string;
  location: string | null;
  selectedEntreeVenue: Venue | null;
  selectedActivityVenues: Record<string, Venue>;
  startPoint: Waypoint | null;
  pickupPoint: Waypoint | null;
};

type TimelineStop = {
  key: string;
  label: string;
  icon: string;
  startMinutes: number;
  endMinutes: number;
  venue: Venue | null;
};

function buildStops(plan: PlanData): string[] {
  const hasEntree = !!plan.selectedEntree && plan.selectedEntree !== "Surprise me";
  return [...plan.selectedActivities, ...(hasEntree ? [ENTREE_KEY] : [])];
}


function downloadICS(
  timeline: TimelineStop[],
  selectedDate: string | null,
  planId: string,
  planLink: string,
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CutelyAsk//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  const datePart = selectedDate ? selectedDate.replace(/-/g, "") : new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const description = icsEscape(buildItineraryText(timeline, planLink));

  for (const stop of timeline) {
    if (!stop.venue) continue;
    const startH = Math.floor(stop.startMinutes / 60) % 24;
    const startM = stop.startMinutes % 60;
    const endH = Math.floor(stop.endMinutes / 60) % 24;
    const endM = stop.endMinutes % 60;
    const dtstart = `${datePart}T${startH.toString().padStart(2, "0")}${startM.toString().padStart(2, "0")}00`;
    const dtend = `${datePart}T${endH.toString().padStart(2, "0")}${endM.toString().padStart(2, "0")}00`;

    lines.push(
      "BEGIN:VEVENT",
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${icsEscape(`${stop.icon} ${stop.label} — ${stop.venue.name}`)}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${icsEscape(stop.venue.address)}`,
      `UID:${stop.key}-${planId}@cutelyask`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "date-night.ics";
  a.click();
  URL.revokeObjectURL(url);
}

export function SenderPlanningView({ planId, plan }: { planId: string; plan: PlanData }) {
  const router = useRouter();
  const [stopOrder, setStopOrder] = useState<string[]>(() => buildStops(plan));
  const [activityVenues, setActivityVenues] = useState<Record<string, Venue>>(plan.selectedActivityVenues);
  const [entreeVenue, setEntreeVenue] = useState<Venue | null>(plan.selectedEntreeVenue);

  const [venueResults, setVenueResults] = useState<Record<string, Venue[]>>({});
  const [venueLoading, setVenueLoading] = useState<Record<string, boolean>>({});
  const [venueOffset, setVenueOffset] = useState<Record<string, number>>({});
  const [venueHasMore, setVenueHasMore] = useState<Record<string, boolean>>({});

  const [radius, setRadius] = useState("8000");
  const [priceFilter, setPriceFilter] = useState<number | null>(null);
  const [stopDurations, setStopDurations] = useState<Record<string, number>>(() => {
    const d: Record<string, number> = {};
    for (const key of buildStops(plan)) {
      d[key] = DEFAULT_STOP_DURATIONS[key] ?? 60;
    }
    return d;
  });

  const [searchLocation, setSearchLocation] = useState(plan.location ?? "");
  const [locationDraft, setLocationDraft] = useState(plan.location ?? "");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [pinMode, setPinMode] = useState(false);
  const [notifyStatus, setNotifyStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");

  // Venues the sender has 👍'd on past dates, grouped by activity ("Places you loved").
  const [lovedByActivity, setLovedByActivity] = useState<Record<string, Venue[]>>({});
  const [showReminisce, setShowReminisce] = useState(false);
  // The stop whose recommendations are shown as red pins on the map.
  const [activeStopKey, setActiveStopKey] = useState<string | null>(() => buildStops(plan)[0] ?? null);

  // Saved addresses + start/pickup waypoints (your place → pick up your date → …).
  const [savedAddrs, setSavedAddrs] = useState<SavedAddress[]>([]);
  const [startPoint, setStartPoint] = useState<Waypoint | null>(plan.startPoint);
  const [pickupPoint, setPickupPoint] = useState<Waypoint | null>(plan.pickupPoint);

  const hasFetched = useRef(false);

  function isNatural(key: string): boolean {
    return key in NATURAL_PLACE_ACTIVITIES;
  }

  function getStopQuery(key: string): string | null {
    if (key === ENTREE_KEY) {
      return plan.selectedEntree && plan.selectedEntree !== "Surprise me"
        ? `${plan.selectedEntree} restaurant`
        : null;
    }
    if (isNatural(key)) return key; // signal for Overpass routing
    if (NO_VENUE_ACTIVITIES.has(key)) return null;
    return ACTIVITY_PLACE_QUERY[key] ?? null;
  }

  function getSelectedVenue(key: string): Venue | null {
    return key === ENTREE_KEY ? entreeVenue : (activityVenues[key] ?? null);
  }

  async function fetchVenues(key: string, _query: string, radiusVal: string, loc: string, append = false) {
    if (!loc.trim()) return;
    setVenueLoading((p) => ({ ...p, [key]: true }));
    try {
      let url: string;
      if (isNatural(key)) {
        const type = NATURAL_PLACE_ACTIVITIES[key] ?? "park";
        url = `/api/natural-places?activity=${encodeURIComponent(type)}&location=${encodeURIComponent(loc)}&radius=${radiusVal}`;
      } else {
        const offset = append ? (venueOffset[key] ?? 0) : 0;
        const q = key === ENTREE_KEY
          ? `${plan.selectedEntree ?? ""} restaurant`
          : (ACTIVITY_PLACE_QUERY[key] ?? key);
        url = `/api/places?q=${encodeURIComponent(q)}&location=${encodeURIComponent(loc)}&radius=${radiusVal}&offset=${offset}&limit=${PAGE_SIZE}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as { venues: Venue[] };
        const incoming = data.venues ?? [];
        const isYelp = !isNatural(key);
        const offset = append && isYelp ? (venueOffset[key] ?? 0) : 0;
        setVenueResults((p) => ({
          ...p,
          [key]: append && isYelp ? [...(p[key] ?? []), ...incoming] : incoming,
        }));
        setVenueHasMore((p) => ({ ...p, [key]: isYelp && incoming.length === PAGE_SIZE }));
        setVenueOffset((p) => ({ ...p, [key]: offset + incoming.length }));
      }
    } catch {}
    setVenueLoading((p) => ({ ...p, [key]: false }));
  }

  function fetchAll(radiusVal: string, loc: string) {
    for (const key of buildStops(plan)) {
      const query = getStopQuery(key);
      if (query) void fetchVenues(key, query, radiusVal, loc);
    }
  }

  useEffect(() => {
    if (hasFetched.current || !searchLocation) return;
    hasFetched.current = true;
    fetchAll(radius, searchLocation);
    void geocodeForward(searchLocation);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the sender's saved addresses for the Start/Pickup quick-pick.
  useEffect(() => {
    let active = true;
    fetch("/api/addresses")
      .then((r) => (r.ok ? r.json() : { addresses: [] }))
      .then((data: { addresses?: SavedAddress[] }) => {
        if (active) setSavedAddrs(data.addresses ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Load the sender's liked spots once, so the picker can recommend favorites.
  useEffect(() => {
    let active = true;
    fetch("/api/verdicts?liked=true")
      .then((r) => (r.ok ? r.json() : { verdicts: [] }))
      .then((data: { verdicts?: { activity: string | null; venue: Venue }[] }) => {
        if (!active) return;
        const grouped: Record<string, Venue[]> = {};
        for (const v of data.verdicts ?? []) {
          const key = v.activity ?? "__other__";
          (grouped[key] ??= []).push(v.venue);
        }
        setLovedByActivity(grouped);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);


  async function geocodeForward(loc: string) {
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(loc)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { lat: number | null; lng: number | null };
      if (data.lat != null && data.lng != null) setMapCenter({ lat: data.lat, lng: data.lng });
    } catch {}
  }

  async function applyLocation() {
    const loc = locationDraft.trim();
    if (!loc) return;
    setSearchLocation(loc);
    fetchAll(radius, loc);
    await geocodeForward(loc);
  }

  function moveStop(index: number, dir: -1 | 1) {
    const next = [...stopOrder];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setStopOrder(next);
    setSaved(false);
  }

  function selectVenue(key: string, venue: Venue | null) {
    if (key === ENTREE_KEY) {
      setEntreeVenue(venue);
    } else {
      setActivityVenues((p) => {
        const n = { ...p };
        if (venue) n[key] = venue;
        else delete n[key];
        return n;
      });
    }
    setSaved(false);
  }

  function setDuration(key: string, minutes: number) {
    setStopDurations((p) => ({ ...p, [key]: minutes }));
  }

  const initialStops = buildStops(plan);
  const isDirty =
    JSON.stringify(stopOrder) !== JSON.stringify(initialStops) ||
    JSON.stringify(activityVenues) !== JSON.stringify(plan.selectedActivityVenues) ||
    entreeVenue?.id !== plan.selectedEntreeVenue?.id ||
    JSON.stringify(startPoint) !== JSON.stringify(plan.startPoint) ||
    JSON.stringify(pickupPoint) !== JSON.stringify(plan.pickupPoint);

  // Compute timeline — running accumulator via reduce (no render-time reassignment)
  const startOfDay = parseTimeToMinutes(plan.selectedTime);
  const timeline: TimelineStop[] = stopOrder.reduce<TimelineStop[]>((acc, key) => {
    const isEntree = key === ENTREE_KEY;
    const duration = stopDurations[key] ?? 60;
    const start = acc.length ? acc[acc.length - 1].endMinutes : startOfDay;
    acc.push({
      key,
      label: isEntree ? (plan.selectedEntree ?? "Food") : key,
      icon: isEntree ? "🍽️" : (ACTIVITY_ICONS[key] ?? "✨"),
      startMinutes: start,
      endMinutes: start + duration,
      venue: isEntree ? entreeVenue : (activityVenues[key] ?? null),
    });
    return acc;
  }, []);

  async function handlePinMove(lat: number, lng: number) {
    setMapCenter({ lat, lng });
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      if (!res.ok) return;
      const data = (await res.json()) as { label: string | null };
      if (data.label) {
        setLocationDraft(data.label);
        setSearchLocation(data.label);
        fetchAll(radius, data.label);
      }
    } catch {}
  }

  async function handleNotify(mode: "share" | "surprise") {
    setNotifyStatus("loading");
    try {
      const res = await fetch(`/api/plans/${planId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (res.ok) {
        setNotifyStatus("sent");
        router.refresh(); // plan is now confirmed → reveal the post-date review section
      } else {
        setNotifyStatus("error");
      }
    } catch {
      setNotifyStatus("error");
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedEntreeVenue: entreeVenue,
          selectedActivityVenues: activityVenues,
          startPoint,
          pickupPoint,
          activityOrder: stopOrder.filter((k) => k !== ENTREE_KEY),
        }),
      });
      if (res.ok) {
        setSaved(true);
        const data = (await res.json().catch(() => null)) as { itineraryUpdated?: boolean } | null;
        // The plan page renders the itinerary server-side, so refresh to show the
        // version that was just regenerated from the chosen venues.
        if (data?.itineraryUpdated) router.refresh();
      } else {
        setSaveError("Couldn't save. Try again.");
      }
    } catch {
      setSaveError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  // Memoized so the array reference is stable across renders — otherwise the map
  // re-renders its stops on every keystroke and overrides the "search near" fly-to.
  const mapStops: (Venue | null)[] = useMemo(
    () => stopOrder.map((key) => (key === ENTREE_KEY ? entreeVenue : (activityVenues[key] ?? null))),
    [stopOrder, activityVenues, entreeVenue],
  );

  // Recommendation pins for the focused stop.
  const activeCandidates = useMemo(
    () => (activeStopKey ? (venueResults[activeStopKey] ?? []) : []),
    [activeStopKey, venueResults],
  );
  const activeSelectedId = activeStopKey ? (getSelectedVenue(activeStopKey)?.id ?? null) : null;

  // Map pins for start/pickup (only when geocoded).
  const waypoints = useMemo(
    () => [
      ...(startPoint && startPoint.lat
        ? [{ id: "start", label: startPoint.label, lat: startPoint.lat, lng: startPoint.lng, kind: "start" as const }]
        : []),
      ...(pickupPoint && pickupPoint.lat
        ? [{ id: "pickup", label: pickupPoint.label, lat: pickupPoint.lat, lng: pickupPoint.lng, kind: "pickup" as const }]
        : []),
    ],
    [startPoint, pickupPoint],
  );

  const routeVenues = mapStops.filter(Boolean) as Venue[];
  // Route goes: your place → pick up your date → each chosen venue.
  const routeCoords = [
    ...waypoints.map((w) => `${w.lat},${w.lng}`),
    ...routeVenues.map((v) => `${v.lat},${v.lng}`),
  ];
  const routeUrl =
    routeCoords.length >= 2
      ? `https://www.google.com/maps/dir/${routeCoords.join("/")}`
      : null;

  const hasAnyVenue = timeline.some((s) => s.venue !== null);

  // Exact sunset/dusk for the date + map center (browser-local time).
  const sun = (() => {
    if (!mapCenter || !plan.selectedDate) return null;
    const d = new Date(`${plan.selectedDate}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const t = SunCalc.getTimes(d, mapCenter.lat, mapCenter.lng);
    if (!t.sunset || Number.isNaN(t.sunset.getTime())) return null;
    const toMin = (x: Date) => x.getHours() * 60 + x.getMinutes();
    const dusk = t.dusk && !Number.isNaN(t.dusk.getTime()) ? toMin(t.dusk) : toMin(t.sunset) + 35;
    return { sunset: toMin(t.sunset), dusk };
  })();

  const planLink =
    (typeof window !== "undefined" ? window.location.origin : "") + `/plan/${planId}`;
  const itineraryText = buildItineraryText(timeline, planLink);

  const radiusMi = Math.max(1, Math.round(parseInt(radius, 10) / 1609));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <h1 className="mb-1 text-2xl font-black text-[#3a2530] sm:text-3xl">Your date plan ✨</h1>
      <p className="mb-6 text-[#8a6a78] sm:mb-8">Here&apos;s what {plan.recipientName} chose.</p>

      <div className="grid gap-6 lg:gap-8 lg:grid-cols-[1fr_420px]">
        {/* Left column */}
        <div className="space-y-6">
          <section className="rounded-[24px] border-2 border-[#ffd6e8] bg-white p-4 sm:p-5">
            <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
              The date
            </h2>

            <dl className="mb-4 grid gap-3">
              <HerRow icon="📅" label="Date" value={plan.selectedDateLabel ?? "—"} />
              <HerRow icon="🕰️" label="Time" value={plan.selectedTimeLabel ?? "—"} />
              {plan.dressVibe && (
                <HerRow icon="👗" label="Her vibe" value={DRESS_VIBE_LABELS[plan.dressVibe] ?? plan.dressVibe} />
              )}
            </dl>

            <hr className="mb-4 border-[#ffd6e8]" />

            {/* Getting there — start + pickup */}
            <div className="mb-4">
              <p className="mb-1.5 text-xs font-black uppercase tracking-widest text-[#c0a0b0]">
                Getting there
              </p>
              <div className="grid gap-2">
                <WaypointPicker kind="start" value={startPoint} saved={savedAddrs} onChange={setStartPoint} />
                <WaypointPicker kind="pickup" value={pickupPoint} saved={savedAddrs} onChange={setPickupPoint} />
              </div>
            </div>

            {/* Search location */}
            <div className="mb-4">
              <p className="mb-1.5 text-xs font-black uppercase tracking-widest text-[#c0a0b0]">
                Search near
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={locationDraft}
                  onChange={(e) => setLocationDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void applyLocation(); }}
                  placeholder="City, neighborhood, or zip code"
                  className="flex-1 rounded-2xl border-2 border-[#ffd6e8] px-3 py-2 text-sm font-black text-[#3a2530] placeholder:font-normal placeholder:text-[#c0a0b0] outline-none focus:border-[#ff7aaa]"
                />
                <button
                  type="button"
                  onClick={() => void applyLocation()}
                  className="shrink-0 rounded-full bg-[#ff7aaa] px-4 py-2 text-sm font-black text-white outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Search range slider */}
            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-black text-[#c0a0b0]">📍 Search range</span>
                <span className="text-xs font-black text-[#8a6a78]">{radiusMi} mi</span>
              </div>
              <input
                type="range"
                min={1}
                max={60}
                value={radiusMi}
                aria-label="Search range in miles"
                onChange={(e) => setRadius(String(Math.round(Number(e.target.value) * 1609)))}
                onPointerUp={() => fetchAll(radius, searchLocation)}
                onKeyUp={() => fetchAll(radius, searchLocation)}
                className="w-full accent-[#ff7aaa]"
              />
              <p className="mt-0.5 text-[10px] text-[#c0a0b0]">
                Restaurants cap at ~25 mi (Yelp); parks &amp; viewpoints can go the full range.
              </p>
            </div>

            {/* Price */}
            <div className="mb-4 flex flex-wrap gap-2">
              <div className="flex items-center gap-1 rounded-full border-2 border-[#ffd6e8] px-3 py-1.5">
                <span className="mr-1 text-xs font-black text-[#c0a0b0]">💰 Price</span>
                {([null, 1, 2, 3, 4] as const).map((p) => (
                  <button
                    key={p ?? "all"}
                    type="button"
                    onClick={() => setPriceFilter(p)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-black transition ${
                      priceFilter === p
                        ? "bg-[#ff7aaa] text-white"
                        : "text-[#8a6a78] hover:bg-[#fff7fb]"
                    }`}
                  >
                    {p === null ? "All" : PRICE_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            {/* Reminisce — rebuild a date from past favorites */}
            {Object.keys(lovedByActivity).length > 0 && (
              <div className="mb-4 rounded-2xl border-2 border-[#e7d9ff] bg-[#faf7ff] p-3">
                <button
                  type="button"
                  onClick={() => setShowReminisce((s) => !s)}
                  className="flex w-full items-center justify-between text-sm font-black text-[#7c5aa0]"
                >
                  <span>💘 Reminisce — your favorite spots</span>
                  <span className="text-xs">{showReminisce ? "▲ hide" : "▼ show"}</span>
                </button>

                {showReminisce && (
                  <div className="mt-3 grid gap-2">
                    {Object.entries(lovedByActivity).flatMap(([activity, venues]) =>
                      venues.map((v) => {
                        const inLineup = stopOrder.includes(activity);
                        const selectedId =
                          activity === ENTREE_KEY ? entreeVenue?.id : activityVenues[activity]?.id;
                        const isSelected = selectedId === v.id;
                        const label =
                          activity === ENTREE_KEY ? (plan.selectedEntree ?? "Food") : activity;
                        const icon =
                          activity === ENTREE_KEY ? "🍽️" : (ACTIVITY_ICONS[activity] ?? "✨");

                        return (
                          <div
                            key={`${activity}-${v.id}`}
                            className="flex items-center gap-3 rounded-xl border-2 border-[#e7d9ff] bg-white p-2.5"
                          >
                            <span className="text-lg">{icon}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black text-[#3a2530]">{v.name}</p>
                              <p className="truncate text-xs text-[#8a6a78]">{v.address}</p>
                            </div>
                            {inLineup ? (
                              <button
                                type="button"
                                onClick={() => selectVenue(activity, isSelected ? null : v)}
                                className={`shrink-0 rounded-full px-3 py-1 text-xs font-black transition ${
                                  isSelected
                                    ? "bg-[#5fd97f] text-white"
                                    : "border-2 border-[#c7a6ff] text-[#7c5aa0] hover:bg-[#f5f0ff]"
                                }`}
                              >
                                {isSelected ? "Added ✓" : `Use for ${label}`}
                              </button>
                            ) : (
                              <span className="shrink-0 text-[10px] font-black text-[#c0a0b0]">
                                not in this date
                              </span>
                            )}
                          </div>
                        );
                      }),
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Stop cards */}
            <div className="grid gap-3">
              {stopOrder.map((key, i) => {
                const isEntree = key === ENTREE_KEY;
                const label = isEntree ? (plan.selectedEntree ?? "Food") : key;
                const icon = isEntree ? "🍽️" : (ACTIVITY_ICONS[key] ?? "✨");
                const query = getStopQuery(key);
                const hasVenueSearch = !!query && !NO_VENUE_ACTIVITIES.has(key);
                const selected = getSelectedVenue(key);
                const lovedVenues = lovedByActivity[key] ?? [];
                const lovedIds = new Set(lovedVenues.map((v) => v.id));
                const rawResults = (venueResults[key] ?? []).filter((v) => !lovedIds.has(v.id));
                const results =
                  priceFilter === null || isNatural(key)
                    ? rawResults
                    : rawResults.filter((v) => v.priceLevel === priceFilter);
                const loading = venueLoading[key] ?? false;
                const hasMore = venueHasMore[key] ?? false;
                const duration = stopDurations[key] ?? 60;

                return (
                  <StopCard
                    key={key}
                    stopNumber={i + 1}
                    label={label}
                    icon={icon}
                    hasQuery={hasVenueSearch}
                    selected={selected}
                    lovedVenues={lovedVenues}
                    results={results}
                    loading={loading}
                    hasMore={hasMore}
                    isFirst={i === 0}
                    isLast={i === stopOrder.length - 1}
                    duration={duration}
                    isActive={key === activeStopKey}
                    onActivate={() => setActiveStopKey(key)}
                    onDurationChange={(m) => setDuration(key, m)}
                    onMoveUp={() => moveStop(i, -1)}
                    onMoveDown={() => moveStop(i, 1)}
                    onSelect={(v) => selectVenue(key, v)}
                    onRefresh={hasVenueSearch ? () => void fetchVenues(key, query, radius, searchLocation) : undefined}
                    onLoadMore={
                      hasVenueSearch && !isNatural(key)
                        ? () => void fetchVenues(key, query, radius, searchLocation, true)
                        : undefined
                    }
                  />
                );
              })}
            </div>

            {saveError && <p className="mt-3 text-sm text-red-500">{saveError}</p>}

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || (!isDirty && saved)}
              className="mt-5 w-full rounded-full bg-[#ff7aaa] py-3 font-black text-white shadow-[0_8px_20px_rgba(255,122,170,0.32)] transition disabled:opacity-60 hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
            >
              {saving ? "Saving…" : saved && !isDirty ? "Spots saved ✓" : "Save spots"}
            </button>

            {routeUrl && (
              <a
                href={routeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#c7a6ff] py-3 font-black text-[#7c5aa0] transition hover:bg-[#f5f0ff]"
              >
                🗺️ Get directions for full route
              </a>
            )}
          </section>

          {/* Timeline section */}
          {timeline.length > 0 && (
            <section className="rounded-[24px] border-2 border-[#e7d9ff] bg-white p-5">
              <div className="mb-1 flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-widest text-[#c0a0b0]">
                  Timeline
                </h2>
                {hasAnyVenue && (
                  <button
                    type="button"
                    onClick={() => downloadICS(timeline, plan.selectedDate, planId, planLink)}
                    className="rounded-full border-2 border-[#c7a6ff] px-3 py-1 text-xs font-black text-[#7c5aa0] transition hover:bg-[#f5f0ff]"
                  >
                    📅 Download .ics
                  </button>
                )}
              </div>

              {sun && (
                <p className="mb-4 text-xs font-black text-[#c0a0b0]">
                  🌅 Sunset ~{formatTime(sun.sunset)} · 🌌 Dark ~{formatTime(sun.dusk)}
                </p>
              )}

              <div className="grid gap-3">
                {timeline.map((stop) => (
                  <TimelineRow
                    key={stop.key}
                    stop={stop}
                    selectedDate={plan.selectedDate}
                    details={itineraryText}
                    warning={sunWarning(stop.key, stop.startMinutes, sun)}
                  />
                ))}
              </div>

              {!hasAnyVenue && (
                <p className="mt-2 text-center text-sm text-[#c0a0b0]">
                  Select spots above to see Google Calendar links.
                </p>
              )}
            </section>
          )}
        </div>

        {/* Right column — map */}
        <div>
          <div className="space-y-3 lg:sticky lg:top-4">
            <div className="h-[320px] overflow-hidden rounded-[20px] border-2 border-[#ffd6e8] shadow-sm sm:h-[440px]">
              <DateMap
                stops={mapStops}
                pinMode={pinMode}
                searchRadius={parseInt(radius, 10)}
                onCenterChange={(lat, lng) => void handlePinMove(lat, lng)}
                viewCenter={mapCenter}
                candidates={activeCandidates}
                selectedId={activeSelectedId}
                onCandidateSelect={(v) => {
                  if (activeStopKey) selectVenue(activeStopKey, v);
                }}
                waypoints={waypoints}
              />
            </div>

            <button
              type="button"
              onClick={() => setPinMode((p) => !p)}
              className={`w-full rounded-full border-2 py-2.5 text-sm font-black transition ${
                pinMode
                  ? "border-[#ff7aaa] bg-[#ff7aaa] text-white"
                  : "border-[#ffd6e8] text-[#8a6a78] hover:bg-[#fff7fb]"
              }`}
            >
              {pinMode ? "📍 Drag pin to set search area" : "📍 Pick center on map"}
            </button>

            {!mapStops.some(Boolean) && !pinMode && (
              <p className="text-center text-sm text-[#c0a0b0]">
                Select a spot for each stop and it&apos;ll appear on the map.
              </p>
            )}

            {/* Notify section */}
            {saved && !isDirty && (
              <div className="rounded-[20px] border-2 border-[#e7d9ff] bg-[#f5f0ff] p-4">
                <p className="mb-1 text-sm font-black text-[#7c5aa0]">
                  Loop in {plan.recipientName}?
                </p>
                <p className="mb-3 text-xs text-[#a088c0]">
                  Send her a notification that the plan is locked.
                </p>

                {notifyStatus === "sent" ? (
                  <p className="text-center font-black text-[#7c5aa0]">Notification sent ✓</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void handleNotify("share")}
                      disabled={notifyStatus === "loading"}
                      className="rounded-full bg-[#c7a6ff] py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
                    >
                      Share plan 💌
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleNotify("surprise")}
                      disabled={notifyStatus === "loading"}
                      className="rounded-full border-2 border-[#c7a6ff] py-2.5 text-sm font-black text-[#7c5aa0] transition hover:bg-[#e7d9ff] disabled:opacity-60"
                    >
                      Surprise her 🎁
                    </button>
                  </div>
                )}

                {notifyStatus === "error" && (
                  <p className="mt-2 text-center text-xs text-red-500">
                    Couldn&apos;t send — try again.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  stop,
  selectedDate,
  details,
  warning,
}: {
  stop: TimelineStop;
  selectedDate: string | null;
  details: string;
  warning: string | null;
}) {
  const venueLocation = stop.venue?.address ?? "";
  const gcalLink = stop.venue
    ? buildGCalLink(
        `${stop.icon} ${stop.label} — ${stop.venue.name}`,
        stop.startMinutes,
        stop.endMinutes,
        venueLocation,
        selectedDate,
        details,
      )
    : null;

  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 text-right">
        <p className="text-xs font-black text-[#3a2530]">{formatTime(stop.startMinutes)}</p>
        <p className="text-[10px] text-[#c0a0b0]">{formatDuration(stop.endMinutes - stop.startMinutes)}</p>
      </div>

      <div className="mt-0.5 flex h-full flex-col items-center">
        <span className="text-base">{stop.icon}</span>
        <div className="mt-1 w-px flex-1 bg-[#ffd6e8]" style={{ minHeight: 16 }} />
      </div>

      <div className="min-w-0 flex-1 pb-2">
        <p className="text-sm font-black text-[#3a2530]">{stop.label}</p>
        {warning && (
          <p className="text-[11px] font-black text-[#d98a3a]">{warning}</p>
        )}
        {stop.venue ? (
          <>
            <p className="truncate text-xs text-[#8a6a78]">{stop.venue.name}</p>
            {gcalLink && (
              <a
                href={gcalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#f5f0ff] px-2.5 py-0.5 text-[10px] font-black text-[#7c5aa0] transition hover:bg-[#e7d9ff]"
              >
                📅 Add to Google Calendar
              </a>
            )}
          </>
        ) : (
          <p className="text-xs text-[#c0a0b0]">No spot selected yet</p>
        )}
      </div>
    </div>
  );
}

function StopCard({
  stopNumber,
  label,
  icon,
  hasQuery,
  selected,
  lovedVenues,
  results,
  loading,
  hasMore,
  isFirst,
  isLast,
  duration,
  isActive,
  onActivate,
  onDurationChange,
  onMoveUp,
  onMoveDown,
  onSelect,
  onRefresh,
  onLoadMore,
}: {
  stopNumber: number;
  label: string;
  icon: string;
  hasQuery: boolean;
  selected: Venue | null;
  lovedVenues: Venue[];
  results: Venue[];
  loading: boolean;
  hasMore: boolean;
  isFirst: boolean;
  isLast: boolean;
  duration: number;
  isActive: boolean;
  onActivate: () => void;
  onDurationChange: (m: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSelect: (v: Venue | null) => void;
  onRefresh?: () => void;
  onLoadMore?: () => void;
}) {
  return (
    <div
      className={`rounded-[20px] border-2 p-4 transition ${
        isActive ? "border-[#d32323]/50 bg-white" : "border-[#ffd6e8] bg-[#fff7fb]"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Move stop up"
            className="grid h-5 w-5 place-items-center rounded text-xs font-black text-[#c0a0b0] transition hover:bg-[#ffd6e8] hover:text-[#7c3653] disabled:pointer-events-none disabled:opacity-0"
          >
            ↑
          </button>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#ff7aaa] text-xs font-black text-white shadow-sm">
            {stopNumber}
          </span>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Move stop down"
            className="grid h-5 w-5 place-items-center rounded text-xs font-black text-[#c0a0b0] transition hover:bg-[#ffd6e8] hover:text-[#7c3653] disabled:pointer-events-none disabled:opacity-0"
          >
            ↓
          </button>
        </div>

        <span className="text-xl">{icon}</span>
        <p className="flex-1 font-black text-[#3a2530]">{label}</p>

        {hasQuery && (
          <button
            type="button"
            onClick={onActivate}
            aria-pressed={isActive}
            title="Show these options on the map"
            className={`shrink-0 rounded-full border-2 px-2.5 py-1 text-xs font-black transition ${
              isActive
                ? "border-[#d32323] bg-[#d32323] text-white"
                : "border-[#ffd6e8] text-[#8a6a78] hover:bg-[#ffd6e8]"
            }`}
          >
            🗺️ Map
          </button>
        )}

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="shrink-0 rounded-full border-2 border-[#ffd6e8] px-3 py-1 text-xs font-black text-[#8a6a78] transition hover:bg-[#ffd6e8] disabled:opacity-50"
          >
            {loading && results.length > 0 ? "…" : "Refresh"}
          </button>
        )}
      </div>

      {/* Duration selector */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="text-xs font-black text-[#c0a0b0]">⏱ Time</span>
        <div className="flex flex-wrap gap-1">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onDurationChange(opt.value)}
              className={`rounded-full px-2 py-0.5 text-xs font-black transition ${
                duration === opt.value
                  ? "bg-[#c7a6ff] text-white"
                  : "border border-[#ffd6e8] text-[#8a6a78] hover:bg-[#ffd6e8]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Places you loved (from past 👍 swipes for this activity) */}
      {lovedVenues.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-black text-[#c0a0b0]">💘 Places you loved</p>
          <div className="grid gap-2">
            {lovedVenues.map((v) => (
              <VenueCard
                key={`loved-${v.id}`}
                venue={v}
                selected={selected?.id === v.id}
                loved
                onSelect={() => onSelect(selected?.id === v.id ? null : v)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Venue results */}
      {hasQuery && (
        <div className="mt-3 grid gap-2">
          {loading && results.length === 0 ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-[#ffd6e8]/40" />
              ))}
            </>
          ) : results.length > 0 ? (
            <>
              {results.map((v) => (
                <VenueCard
                  key={v.id}
                  venue={v}
                  selected={selected?.id === v.id}
                  onSelect={() => onSelect(selected?.id === v.id ? null : v)}
                />
              ))}
              {loading && (
                <div className="h-10 animate-pulse rounded-2xl bg-[#ffd6e8]/40" />
              )}
              {!loading && hasMore && onLoadMore && (
                <button
                  type="button"
                  onClick={onLoadMore}
                  className="mt-1 w-full rounded-full border-2 border-[#ffd6e8] py-2 text-xs font-black text-[#8a6a78] transition hover:bg-[#ffd6e8]"
                >
                  Load 5 more →
                </button>
              )}
            </>
          ) : (
            <p className="py-2 text-center text-sm text-[#c0a0b0]">
              No spots found — try a wider range or different location.
            </p>
          )}
        </div>
      )}

      {!hasQuery && (
        <p className="mt-2 text-xs text-[#c0a0b0]">No specific venue needed for this stop.</p>
      )}
    </div>
  );
}

function VenueCard({
  venue,
  selected,
  onSelect,
  loved = false,
}: {
  venue: Venue;
  selected: boolean;
  onSelect: () => void;
  loved?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border-2 p-3 transition ${
        selected
          ? "border-[#ff7aaa] bg-white shadow-sm"
          : "border-[#ffd6e8] bg-white/70 hover:bg-white"
      }`}
    >
      {venue.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={venue.imageUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#ffd6e8]/50 text-xl">
          📍
        </div>
      )}

      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#ff7aaa]"
      >
        <p className="truncate font-black text-[#3a2530]">
          {loved && <span className="mr-1">💘</span>}
          {venue.name}
        </p>
        <p className="truncate text-xs text-[#8a6a78]">{venue.address}</p>
        <p className="text-xs font-black text-[#8a6a78]">
          {loved
            ? "You loved this"
            : `${venue.rating > 0 ? `★ ${venue.rating.toFixed(1)}` : "Free"} · ${venue.priceLevel === 1 ? "Free" : PRICE_LABELS[venue.priceLevel]}`}
        </p>
      </button>

      <a
        href={`https://maps.google.com/?q=${venue.lat},${venue.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-full bg-[#f5f0ff] px-2.5 py-1.5 text-xs font-black text-[#7c5aa0] transition hover:bg-[#e7d9ff]"
      >
        Directions
      </a>
    </div>
  );
}

function WaypointPicker({
  kind,
  value,
  saved,
  onChange,
}: {
  kind: "start" | "pickup";
  value: Waypoint | null;
  saved: SavedAddress[];
  onChange: (w: Waypoint | null) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const icon = kind === "start" ? "🏠" : "💕";
  const labelText = kind === "start" ? "Your place" : "Pickup";

  async function geocodeAndSet(label: string, query: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const d = (await res.json()) as { lat: number | null; lng: number | null };
      if (d.lat != null && d.lng != null) onChange({ label, lat: d.lat, lng: d.lng });
    } catch {}
    setBusy(false);
  }

  async function pickSaved(a: SavedAddress) {
    if (a.lat != null && a.lng != null) onChange({ label: a.label, lat: a.lat, lng: a.lng });
    else await geocodeAndSet(a.label, a.address);
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-xl border-2 border-[#e7d9ff] bg-[#faf7ff] p-2.5">
        <span className="text-base">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wide text-[#c0a0b0]">{labelText}</p>
          <p className="truncate text-sm font-black text-[#3a2530]">{value.label}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={`Clear ${labelText}`}
          className="shrink-0 px-1.5 text-xs font-black text-[#c0a0b0] transition hover:text-[#d32323]"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-[#ffd6e8] p-2">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (text.trim()) void geocodeAndSet(text.trim(), text.trim());
              setText("");
            }
          }}
          placeholder={`${icon} ${labelText} address`}
          className="min-w-0 flex-1 rounded-lg border-2 border-[#ffd6e8] bg-white px-2.5 py-1.5 text-sm text-[#3a2530] placeholder:text-[#c0a0b0] outline-none focus:border-[#ff7aaa]"
        />
        <button
          type="button"
          onClick={() => {
            if (text.trim()) void geocodeAndSet(text.trim(), text.trim());
            setText("");
          }}
          disabled={busy || !text.trim()}
          className="shrink-0 rounded-lg bg-[#c7a6ff] px-3 text-xs font-black text-white transition disabled:opacity-50"
        >
          {busy ? "…" : "Set"}
        </button>
      </div>
      {saved.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {saved.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => void pickSaved(a)}
              className="rounded-full border border-[#c7a6ff] px-2 py-0.5 text-[10px] font-black text-[#7c5aa0] transition hover:bg-[#f5f0ff]"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HerRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#fff7fb] text-lg">
        {icon}
      </span>
      <div>
        <dt className="text-xs font-black uppercase tracking-[0.14em] text-[#c0a0b0]">{label}</dt>
        <dd className="font-black text-[#3a2530]">{value}</dd>
      </div>
    </div>
  );
}
