"use client";

import confetti from "canvas-confetti";
import { useState } from "react";
import type { EntreeOption, Venue } from "./types";
import {
  entreeIcons,
  entreeNotes,
  entreeOptions,
} from "@/lib/food-options";
import { PRICE_LABELS } from "@/lib/venues";
import { OptionCard } from "./OptionCard";
import { StepCard } from "./StepCard";

type EntreeStepProps = {
  selectedEntree: EntreeOption | null;
  onSelectEntree: (entree: EntreeOption) => void;
  location: string | null;
  selectedEntreeVenue: Venue | null;
  onVenueSelect: (v: Venue | null) => void;
  onNext: () => void;
  onBack: () => void;
};

export function EntreeStep({
  selectedEntree,
  onSelectEntree,
  location,
  selectedEntreeVenue,
  onVenueSelect,
  onNext,
  onBack,
}: EntreeStepProps) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueLoading, setVenueLoading] = useState(false);
  const [venueOpen, setVenueOpen] = useState(false);

  function chooseEntree(entree: EntreeOption) {
    onSelectEntree(entree);
    setVenues([]);
    setVenueOpen(false);
    onVenueSelect(null);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (entree === "Surprise me" && !reduceMotion) {
      confetti({
        particleCount: 36,
        spread: 48,
        origin: { y: 0.78 },
        scalar: 0.72,
        colors: ["#ff7aaa", "#fff3d6", "#c7a6ff", "#b9e4ff"],
      });
    }
  }

  async function findVenues() {
    if (!selectedEntree || !location) return;
    setVenueLoading(true);
    setVenueOpen(true);
    try {
      const res = await fetch(
        `/api/places?q=${encodeURIComponent(selectedEntree + " restaurants")}&location=${encodeURIComponent(location)}`,
      );
      if (!res.ok) { setVenues([]); return; }
      const data = await res.json() as { venues: Venue[] };
      setVenues(data.venues ?? []);
    } catch {
      setVenues([]);
    } finally {
      setVenueLoading(false);
    }
  }

  return (
    <StepCard
      stickerSrc="/assets/food-tray.svg"
      stickerAlt="Kawaii food tray"
      eyebrow="step four"
      title="Should we eat?"
      subtitle="Pick one food plan if the date needs a snacky little anchor. Dessert can be improvised later."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {entreeOptions.map((entree) => (
          <OptionCard
            key={entree}
            title={entree}
            subtitle={entreeNotes[entree]}
            icon={entreeIcons[entree]}
            selected={selectedEntree === entree}
            onClick={() => chooseEntree(entree)}
            special={entree === "Surprise me"}
          />
        ))}
      </div>

      {location && selectedEntree && selectedEntree !== "Surprise me" && (
        <div className="mt-4 rounded-[24px] border-2 border-[#ffd6e8] bg-white/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-[#3a2530]">
              {selectedEntreeVenue
                ? `📍 ${selectedEntreeVenue.name}`
                : `Find restaurants near ${location}`}
            </p>
            <button
              type="button"
              onClick={findVenues}
              disabled={venueLoading}
              className="shrink-0 rounded-full bg-[#ff7aaa] px-4 py-2 text-sm font-black text-white shadow-[0_8px_18px_rgba(255,122,170,0.28)] outline-none disabled:opacity-60 focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
            >
              {venueLoading ? "…" : "Find near →"}
            </button>
          </div>

          {venueOpen && !venueLoading && (
            <div className="mt-3 grid gap-2">
              {venues.length === 0 ? (
                <p className="text-sm text-[#8a6a78]">No venues found. Try a different food type.</p>
              ) : (
                venues.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onVenueSelect(selectedEntreeVenue?.id === v.id ? null : v)}
                    className={`w-full rounded-2xl border-2 px-3 py-2 text-left outline-none transition focus-visible:ring-4 focus-visible:ring-[#ffd6e8] ${
                      selectedEntreeVenue?.id === v.id
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
                onClick={() => { onVenueSelect(null); setVenueOpen(false); }}
                className="mt-1 text-center text-xs font-black text-[#8a6a78] underline underline-offset-2 outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
              >
                skip / pick later
              </button>
            </div>
          )}
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
          disabled={!selectedEntree}
          onClick={onNext}
          className="min-h-14 rounded-full bg-[#ff7aaa] px-5 py-3 font-black text-white shadow-[0_14px_30px_rgba(255,122,170,0.32)] outline-none transition disabled:cursor-not-allowed disabled:bg-[#ffd6e8] disabled:text-[#8a6a78] focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
        >
          add the fun
        </button>
      </div>
    </StepCard>
  );
}
