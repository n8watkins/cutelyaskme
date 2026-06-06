"use client";

import confetti from "canvas-confetti";
import { useMemo, useRef, useState } from "react";
import type { ActivityOption, Venue } from "./types";
import { ACTIVITY_PLACE_QUERY, PRICE_LABELS } from "@/lib/venues";
import { OptionCard } from "./OptionCard";
import { StepCard } from "./StepCard";

type TimePeriod = "morning" | "afternoon" | "evening" | "night";
type Budget = "low-key" | "cozy" | "treat";

const activityDetails: Record<
  ActivityOption,
  { note: string; icon: string; periods: TimePeriod[]; budget: Budget }
> = {
  Coffee: {
    note: "warm drinks and easy talking",
    icon: "☕",
    periods: ["morning", "afternoon"],
    budget: "low-key",
  },
  Walk: {
    note: "low pressure, high cute potential",
    icon: "🌷",
    periods: ["morning", "afternoon", "evening"],
    budget: "low-key",
  },
  Movie: {
    note: "shared popcorn situation",
    icon: "🎞️",
    periods: ["afternoon", "evening", "night"],
    budget: "treat",
  },
  Arcade: {
    note: "tiny competition, no mercy",
    icon: "🕹️",
    periods: ["afternoon", "evening", "night"],
    budget: "treat",
  },
  Bookstore: {
    note: "pick each other a book",
    icon: "📚",
    periods: ["morning", "afternoon", "evening"],
    budget: "low-key",
  },
  Drinks: {
    note: "something sparkly or cozy",
    icon: "🍹",
    periods: ["evening", "night"],
    budget: "treat",
  },
  "Photo booth": {
    note: "proof this was adorable",
    icon: "📸",
    periods: ["afternoon", "evening", "night"],
    budget: "low-key",
  },
  "Mini golf": {
    note: "wholesome chaos",
    icon: "⛳",
    periods: ["morning", "afternoon", "evening"],
    budget: "treat",
  },
  "Farmers market": {
    note: "snacks, flowers, tiny browsing",
    icon: "🍓",
    periods: ["morning", "afternoon"],
    budget: "low-key",
  },
  "Sunset view": {
    note: "pretty sky, very cute timing",
    icon: "🌅",
    periods: ["evening"],
    budget: "low-key",
  },
  "Night market": {
    note: "lights, snacks, wandering",
    icon: "🌙",
    periods: ["night"],
    budget: "low-key",
  },
  "Gallery stroll": {
    note: "look at art, pretend to be thoughtful",
    icon: "🖼️",
    periods: ["morning", "afternoon", "evening"],
    budget: "low-key",
  },
  "Park picnic": {
    note: "blanket, snacks, soft little reset",
    icon: "🧺",
    periods: ["morning", "afternoon", "evening"],
    budget: "cozy",
  },
  "Thrift browse": {
    note: "find something weird and charming",
    icon: "🧥",
    periods: ["morning", "afternoon"],
    budget: "low-key",
  },
  "Record store": {
    note: "pick an album for the mood",
    icon: "🎧",
    periods: ["afternoon", "evening"],
    budget: "low-key",
  },
  "Plant shop": {
    note: "tiny leaves, tiny opinions",
    icon: "🪴",
    periods: ["morning", "afternoon"],
    budget: "low-key",
  },
  Museum: {
    note: "quiet wandering with commentary",
    icon: "🏛️",
    periods: ["morning", "afternoon"],
    budget: "cozy",
  },
  "Board games": {
    note: "cute rivalry, controlled chaos",
    icon: "🎲",
    periods: ["afternoon", "evening", "night"],
    budget: "cozy",
  },
  Karaoke: {
    note: "brave choices, questionable vocals",
    icon: "🎤",
    periods: ["evening", "night"],
    budget: "treat",
  },
  "Live music": {
    note: "good lighting, good excuse to sway",
    icon: "🎵",
    periods: ["evening", "night"],
    budget: "treat",
  },
  Stargazing: {
    note: "tiny sky date energy",
    icon: "🌌",
    periods: ["night"],
    budget: "low-key",
  },
  "Scenic drive": {
    note: "playlist required",
    icon: "🚗",
    periods: ["afternoon", "evening", "night"],
    budget: "cozy",
  },
  "Tea stop": {
    note: "warm cup, soft talking",
    icon: "🫖",
    periods: ["morning", "afternoon", "evening"],
    budget: "cozy",
  },
  "Surprise ending": {
    note: "I plan one little mystery stop",
    icon: "✨",
    periods: ["morning", "afternoon", "evening", "night"],
    budget: "cozy",
  },
};

const slotPairs: Record<TimePeriod, ActivityOption[][]> = {
  morning: [
    ["Coffee", "Farmers market"],
    ["Walk", "Bookstore"],
    ["Mini golf", "Coffee"],
    ["Farmers market", "Surprise ending"],
    ["Walk", "Coffee"],
    ["Bookstore", "Farmers market"],
    ["Mini golf", "Bookstore"],
    ["Coffee", "Walk"],
    ["Farmers market", "Photo booth"],
    ["Bookstore", "Surprise ending"],
    ["Walk", "Mini golf"],
    ["Coffee", "Bookstore"],
    ["Plant shop", "Coffee"],
    ["Thrift browse", "Bookstore"],
    ["Gallery stroll", "Tea stop"],
    ["Museum", "Park picnic"],
    ["Walk", "Plant shop"],
    ["Coffee", "Gallery stroll"],
  ],
  afternoon: [
    ["Bookstore", "Photo booth"],
    ["Mini golf", "Arcade"],
    ["Walk", "Movie"],
    ["Farmers market", "Surprise ending"],
    ["Coffee", "Bookstore"],
    ["Photo booth", "Arcade"],
    ["Mini golf", "Walk"],
    ["Movie", "Photo booth"],
    ["Farmers market", "Bookstore"],
    ["Arcade", "Surprise ending"],
    ["Walk", "Coffee"],
    ["Bookstore", "Movie"],
    ["Gallery stroll", "Record store"],
    ["Plant shop", "Tea stop"],
    ["Museum", "Park picnic"],
    ["Thrift browse", "Coffee"],
    ["Board games", "Photo booth"],
    ["Scenic drive", "Surprise ending"],
  ],
  evening: [
    ["Sunset view", "Photo booth"],
    ["Arcade", "Drinks"],
    ["Movie", "Walk"],
    ["Mini golf", "Surprise ending"],
    ["Bookstore", "Sunset view"],
    ["Photo booth", "Drinks"],
    ["Mini golf", "Sunset view"],
    ["Walk", "Drinks"],
    ["Movie", "Photo booth"],
    ["Arcade", "Surprise ending"],
    ["Bookstore", "Drinks"],
    ["Sunset view", "Movie"],
    ["Record store", "Tea stop"],
    ["Gallery stroll", "Sunset view"],
    ["Board games", "Drinks"],
    ["Live music", "Photo booth"],
    ["Scenic drive", "Sunset view"],
    ["Karaoke", "Surprise ending"],
  ],
  night: [
    ["Movie", "Drinks"],
    ["Night market", "Photo booth"],
    ["Arcade", "Surprise ending"],
    ["Drinks", "Night market"],
    ["Movie", "Photo booth"],
    ["Arcade", "Drinks"],
    ["Night market", "Surprise ending"],
    ["Photo booth", "Drinks"],
    ["Movie", "Night market"],
    ["Arcade", "Photo booth"],
    ["Drinks", "Surprise ending"],
    ["Night market", "Movie"],
    ["Stargazing", "Scenic drive"],
    ["Karaoke", "Photo booth"],
    ["Live music", "Drinks"],
    ["Board games", "Night market"],
    ["Stargazing", "Surprise ending"],
    ["Scenic drive", "Movie"],
  ],
};

type AiSuggestion = { idea: string; fromCache: boolean };

type LineupStepProps = {
  selectedTime: string | null;
  selectedDateLabel?: string | null;
  selectedActivities: string[];
  onToggle: (activity: string) => void;
  onSetActivities: (activities: string[]) => void;
  location: string | null;
  selectedActivityVenues: Record<string, Venue>;
  onActivityVenueSelect: (activity: string, venue: Venue | null) => void;
  onNext: () => void;
  onBack: () => void;
};

export function LineupStep({
  selectedTime,
  selectedDateLabel,
  selectedActivities,
  onToggle,
  onSetActivities,
  location,
  selectedActivityVenues,
  onActivityVenueSelect,
  onNext,
  onBack,
}: LineupStepProps) {
  const [budget, setBudget] = useState<Budget>("cozy");
  const [remainingPairs, setRemainingPairs] = useState<ActivityOption[][]>([]);
  const [lastPairKey, setLastPairKey] = useState<string | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activityVenueMap, setActivityVenueMap] = useState<Record<string, Venue[]>>({});
  const [activityVenueLoading, setActivityVenueLoading] = useState<Record<string, boolean>>({});
  const [activityVenueOpen, setActivityVenueOpen] = useState<Record<string, boolean>>({});
  // Prevent duplicate fetches for the same inputs
  const lastAiKey = useRef<string | null>(null);
  const period = getTimePeriod(selectedTime);
  const activityOptions = useMemo(
    () =>
      (Object.keys(activityDetails) as ActivityOption[]).filter((activity) =>
        activityDetails[activity].periods.includes(period) &&
        isBudgetAllowed(activityDetails[activity].budget, budget),
      ),
    [budget, period],
  );
  const expensivePick = selectedActivities.find(
    (activity) =>
      activity in activityDetails &&
      activityDetails[activity as ActivityOption].budget === "treat",
  );

  async function fetchAiSuggestions() {
    const aiKey = `${period}:${selectedTime ?? ""}:${selectedDateLabel ?? ""}`;
    if (lastAiKey.current === aiKey) return; // already fetched for these inputs
    lastAiKey.current = aiKey;
    setAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch("/api/date-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, selectedTime, selectedDateLabel }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAiError((data as { message?: string }).message ?? "Could not get suggestions.");
        lastAiKey.current = null;
        return;
      }
      const data = await res.json() as { ideas: string[]; fromCache: boolean };
      setAiSuggestions(data.ideas.map((idea) => ({ idea, fromCache: data.fromCache })));
    } catch {
      setAiError("Could not reach the AI. Try the spinner instead.");
      lastAiKey.current = null;
    } finally {
      setAiLoading(false);
    }
  }

  function choose(activity: ActivityOption) {
    onToggle(activity);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (activity === "Surprise ending" && !reduceMotion) {
      confetti({
        particleCount: 42,
        spread: 56,
        origin: { y: 0.74 },
        scalar: 0.65,
        colors: ["#ff7aaa", "#ffd6e8", "#c7a6ff", "#b9e4ff"],
      });
    }
  }

  function spinIdeas() {
    const eligiblePairs = slotPairs[period].filter((pair) =>
      pair.every((activity) => isBudgetAllowed(activityDetails[activity].budget, budget)),
    );
    const currentPool = remainingPairs.length
      ? remainingPairs
      : shufflePairs(
          eligiblePairs.filter((pair) => pair.join("|") !== lastPairKey),
        );
    const fallbackPool = currentPool.length ? currentPool : shufflePairs(eligiblePairs);
    const pair = fallbackPool[0];

    setIsRolling(true);
    window.setTimeout(() => setIsRolling(false), 450);
    setRemainingPairs(fallbackPool.slice(1));
    setLastPairKey(pair.join("|"));
    onSetActivities(pair);
    setActivityVenueMap({});
    setActivityVenueOpen({});
    setActivityVenueLoading({});

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) {
      confetti({
        particleCount: 26,
        spread: 42,
        origin: { y: 0.82 },
        scalar: 0.58,
        colors: ["#ff7aaa", "#ffd6e8", "#fff3d6", "#b9e4ff"],
      });
    }
  }

  async function findVenuesForActivity(activity: string) {
    if (!location) return;
    const query = ACTIVITY_PLACE_QUERY[activity];
    if (!query) return;
    setActivityVenueLoading((prev) => ({ ...prev, [activity]: true }));
    setActivityVenueOpen((prev) => ({ ...prev, [activity]: true }));
    try {
      const res = await fetch(
        `/api/places?q=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}`,
      );
      if (!res.ok) { setActivityVenueMap((prev) => ({ ...prev, [activity]: [] })); return; }
      const data = await res.json() as { venues: Venue[] };
      setActivityVenueMap((prev) => ({ ...prev, [activity]: data.venues ?? [] }));
    } catch {
      setActivityVenueMap((prev) => ({ ...prev, [activity]: [] }));
    } finally {
      setActivityVenueLoading((prev) => ({ ...prev, [activity]: false }));
    }
  }

  return (
    <StepCard
      stickerSrc="/assets/speech-heart.svg"
      stickerAlt="Speech bubble with heart"
      eyebrow="step three"
      title="Pick two more cute things."
      subtitle={`We'll pick food after this. ${getPeriodCopy(period)}`}
    >
      <div className="mb-4 rounded-[24px] border-2 border-[#ffd6e8] bg-white/80 p-4">
        <p className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-[#8a6a78]">
          choose a vibe
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["low-key", "cozy", "treat"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setBudget(item);
                setRemainingPairs([]);
                onSetActivities([]);
              }}
              className={`min-h-10 rounded-full border-2 px-2 text-xs font-black capitalize outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8] ${
                budget === item
                  ? "border-[#ff7aaa] bg-[#ff7aaa] text-white"
                  : "border-[#ffd6e8] bg-white text-[#8a6a78]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        {expensivePick ? (
          <p className="mt-3 rounded-2xl bg-[#fff3d6] px-3 py-2 text-center text-xs font-black text-[#7a5a11]">
            {expensivePick}? fancy fancy. I see the vision.
          </p>
        ) : null}
      </div>
      {/* AI suggestions */}
      <div className="mb-4 rounded-[24px] border-2 border-[#e7d9ff] bg-white/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#8a6a78]">
              ✨ AI picks
            </p>
            {aiSuggestions ? (
              <div className="mt-2 grid gap-2">
                {aiSuggestions.map(({ idea, fromCache }) => {
                  const selected = selectedActivities.includes(idea);
                  const disabled = !selected && selectedActivities.length >= 2;
                  return (
                    <button
                      key={idea}
                      type="button"
                      disabled={disabled}
                      onClick={() => onToggle(idea)}
                      className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 text-left text-sm font-black outline-none transition focus-visible:ring-4 focus-visible:ring-[#e7d9ff] ${
                        selected
                          ? "border-[#c7a6ff] bg-[#c7a6ff] text-white"
                          : disabled
                            ? "border-[#ffd6e8] text-[#c0a0b0]"
                            : "border-[#e7d9ff] text-[#3a2530] hover:bg-[#f5f0ff]"
                      }`}
                    >
                      <span>⭐</span>
                      <span>{idea}</span>
                      {fromCache && (
                        <span className="ml-auto text-[10px] font-normal text-[#c0a0b0]">
                          cached
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : aiError ? (
              <p className="mt-1 text-xs text-red-400">{aiError}</p>
            ) : (
              <p className="mt-1 text-xs text-[#c0a0b0]">
                Get two AI-personalised picks for this evening
              </p>
            )}
          </div>
          {!aiSuggestions && (
            <button
              type="button"
              onClick={fetchAiSuggestions}
              disabled={aiLoading}
              className="shrink-0 rounded-full bg-[#c7a6ff] px-4 py-2 text-sm font-black text-white shadow-[0_8px_18px_rgba(199,166,255,0.3)] outline-none disabled:opacity-60 focus-visible:ring-4 focus-visible:ring-[#e7d9ff]"
            >
              {aiLoading ? "…" : "Ask AI"}
            </button>
          )}
          {aiSuggestions && (
            <button
              type="button"
              onClick={() => { setAiSuggestions(null); lastAiKey.current = null; }}
              className="shrink-0 rounded-full border-2 border-[#e7d9ff] px-3 py-1.5 text-xs font-black text-[#8a6a78] outline-none focus-visible:ring-4 focus-visible:ring-[#e7d9ff]"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      <div className="cute-scrollbar max-h-[430px] overflow-y-auto rounded-[26px] border-2 border-[#ffd6e8] bg-[#fff7fb]/65 p-3 pr-2 shadow-inner">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {activityOptions.map((activity) => {
          const selected = selectedActivities.includes(activity);
          const disabled = !selected && selectedActivities.length >= 2;

          return (
            <OptionCard
              key={activity}
              title={activity}
              subtitle={activityDetails[activity].note}
              icon={activityDetails[activity].icon}
              selected={selected}
              disabled={disabled}
              onClick={() => choose(activity)}
              special={activity === "Surprise ending"}
              multi
            />
          );
        })}
        </div>
        <div className="py-4 text-center text-xs font-black uppercase tracking-[0.14em] text-[#8a6a78]">
          more pre-made ideas below
        </div>
      </div>
      <div className="mt-5 rounded-[24px] border-2 border-[#e7d9ff] bg-white/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-left">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#8a6a78]">
              surprise me
            </p>
            <p
              className={`mt-1 text-lg font-black text-[#3a2530] ${
                isRolling ? "animate-[slot-bounce_450ms_ease-in-out]" : ""
              }`}
            >
              {selectedActivities.length
                ? selectedActivities.join(" + ")
                : "roll two for me"}
            </p>
          </div>
          <button
            type="button"
            onClick={spinIdeas}
            className="min-h-12 shrink-0 rounded-full bg-[#c7a6ff] px-5 text-sm font-black text-white shadow-[0_12px_22px_rgba(199,166,255,0.32)] outline-none focus-visible:ring-4 focus-visible:ring-[#e7d9ff]"
          >
            spin
          </button>
        </div>
      </div>
      <div className="mt-4 rounded-full bg-white/75 px-4 py-3 text-sm font-black text-[#8a6a78]">
        {selectedActivities.length === 2
          ? "perfect, that's the cute part of the plan"
          : `choose ${2 - selectedActivities.length} more`}
      </div>
      {location && selectedActivities.length === 2 && (
        <div className="mt-4 grid gap-3">
          {selectedActivities.map((activity) => {
            if (!ACTIVITY_PLACE_QUERY[activity]) return null;
            const open = activityVenueOpen[activity];
            const loading = activityVenueLoading[activity];
            const venues = activityVenueMap[activity] ?? [];
            const selected = selectedActivityVenues[activity] ?? null;
            return (
              <div key={activity} className="rounded-[24px] border-2 border-[#ffd6e8] bg-white/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-[#3a2530]">
                    {selected ? `📍 ${selected.name}` : `Find ${activity} near ${location}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => findVenuesForActivity(activity)}
                    disabled={loading}
                    className="shrink-0 rounded-full bg-[#ff7aaa] px-4 py-2 text-sm font-black text-white shadow-[0_8px_18px_rgba(255,122,170,0.28)] outline-none disabled:opacity-60 focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
                  >
                    {loading ? "…" : "Find near →"}
                  </button>
                </div>
                {open && !loading && (
                  <div className="mt-3 grid gap-2">
                    {venues.length === 0 ? (
                      <p className="text-sm text-[#8a6a78]">No venues found.</p>
                    ) : (
                      venues.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => onActivityVenueSelect(activity, selected?.id === v.id ? null : v)}
                          className={`w-full rounded-2xl border-2 px-3 py-2 text-left outline-none transition focus-visible:ring-4 focus-visible:ring-[#ffd6e8] ${
                            selected?.id === v.id
                              ? "border-[#ff7aaa] bg-[#fff7fb]"
                              : "border-[#ffd6e8] bg-white hover:bg-[#fff7fb]"
                          }`}
                        >
                          <p className="font-black text-[#3a2530]">{v.name}</p>
                          <p className="text-sm text-[#8a6a78]">{v.address}</p>
                          <p className="mt-0.5 text-xs font-black text-[#8a6a78]">
                            {v.rating > 0 ? `★ ${v.rating.toFixed(1)}` : "No rating"} · {PRICE_LABELS[v.priceLevel]}
                          </p>
                        </button>
                      ))
                    )}
                    <button
                      type="button"
                      onClick={() => { onActivityVenueSelect(activity, null); setActivityVenueOpen((prev) => ({ ...prev, [activity]: false })); }}
                      className="mt-1 text-center text-xs font-black text-[#8a6a78] underline underline-offset-2 outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
                    >
                      skip / pick later
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 grid grid-cols-[0.8fr_1.2fr] gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-14 rounded-full border-2 border-[#ffd6e8] bg-white px-5 py-3 font-black text-[#8a6a78] outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
        >
          Back
        </button>
        <button
          type="button"
          disabled={selectedActivities.length !== 2}
          onClick={onNext}
          className="min-h-14 rounded-full bg-[#ff7aaa] px-5 py-3 font-black text-white shadow-[0_14px_30px_rgba(255,122,170,0.32)] outline-none transition disabled:cursor-not-allowed disabled:bg-[#ffd6e8] disabled:text-[#8a6a78] focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
        >
          {selectedActivities.length === 2
            ? `${selectedActivities[0]} + ${selectedActivities[1]} →`
            : "finish plan"}
        </button>
      </div>
    </StepCard>
  );
}

function isBudgetAllowed(activityBudget: Budget, selectedBudget: Budget) {
  if (selectedBudget === "treat") {
    return true;
  }

  if (selectedBudget === "cozy") {
    return activityBudget !== "treat";
  }

  return activityBudget === "low-key";
}

function shufflePairs(pairs: ActivityOption[][]) {
  const next = [...pairs];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function getTimePeriod(selectedTime: string | null): TimePeriod {
  if (!selectedTime) {
    return "evening";
  }

  const hour = Number(selectedTime.split(":")[0]);

  if (hour < 12) {
    return "morning";
  }

  if (hour < 17) {
    return "afternoon";
  }

  if (hour < 21) {
    return "evening";
  }

  return "night";
}

function getPeriodCopy(period: TimePeriod) {
  if (period === "morning") {
    return "Morning plans should stay soft and sunny.";
  }

  if (period === "afternoon") {
    return "Afternoon gives us room to wander.";
  }

  if (period === "night") {
    return "Night plans should feel cozy, not chaotic.";
  }

  return "Evening is perfect for a little extra sparkle.";
}
