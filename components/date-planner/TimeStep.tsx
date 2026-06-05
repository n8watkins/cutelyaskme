"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { StepCard } from "./StepCard";

const timeOptions = [
  {
    value: "10:00",
    label: "10:00 AM",
    note: "coffee and sunlight",
    icon: "☕",
    angle: "-rotate-6",
  },
  {
    value: "13:00",
    label: "1:00 PM",
    note: "easy daytime plan",
    icon: "🍓",
    angle: "rotate-3",
  },
  {
    value: "16:30",
    label: "4:30 PM",
    note: "golden-hour cute",
    icon: "🌤️",
    angle: "-rotate-2",
  },
  {
    value: "18:30",
    label: "6:30 PM",
    note: "dinner sweet spot",
    icon: "🍽️",
    angle: "rotate-2",
  },
  {
    value: "20:00",
    label: "8:00 PM",
    note: "cozy evening plan",
    icon: "🎞️",
    angle: "-rotate-3",
  },
  {
    value: "21:30",
    label: "9:30 PM",
    note: "late little adventure",
    icon: "✨",
    angle: "rotate-6",
  },
] as const;

type TimeStepProps = {
  selectedDate: string | null;
  selectedTime: string | null;
  onSelect: (value: string, label: string) => void;
  onNext: () => void;
  onBack: () => void;
};

export function TimeStep({
  selectedDate,
  selectedTime,
  onSelect,
  onNext,
  onBack,
}: TimeStepProps) {
  const [showCustom, setShowCustom] = useState(false);
  const selectedOption = timeOptions.find((option) => option.value === selectedTime);
  const isToday = selectedDate ? selectedDate === toDateValue(new Date()) : false;
  const nowMinutes = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);
  const availablePresetOptions = timeOptions.filter(
    (option) => !isToday || timeToMinutes(option.value) > nowMinutes,
  );
  const customTimeOptions = useMemo(
    () => getCustomTimeOptions(isToday, nowMinutes),
    [isToday, nowMinutes],
  );
  const [customValue, setCustomValue] = useState("19:00");
  const effectiveCustomValue = customTimeOptions.some(
    (option) => option.value === customValue,
  )
    ? customValue
    : customTimeOptions[0]?.value ?? "19:00";
  const customLabel = `${selectedTimeLabel(effectiveCustomValue)} - picked by you`;

  return (
    <StepCard
      stickerSrc="/assets/heart-clock.svg"
      stickerAlt="Pastel heart clock"
      eyebrow="step two"
      title="What time should we start?"
      subtitle="Pick a cute preset, or make your own little time slot."
    >
      <div className="rounded-[28px] border-2 border-[#ffd6e8] bg-white/80 p-4 shadow-sm">
        {isToday ? (
          <div className="mb-3 rounded-2xl bg-[#fff3d6] px-4 py-3 text-sm font-black text-[#7a5a11]">
            Since this is today, only future times are showing.
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          {availablePresetOptions.map((option) => {
            const fullLabel = `${option.label} - ${option.note}`;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onSelect(option.value, fullLabel)}
                className={cn(
                  "min-h-20 rounded-[22px] border-2 p-3 text-left outline-none transition focus-visible:ring-4 focus-visible:ring-[#ffd6e8]",
                  selectedTime === option.value
                    ? "border-[#ff7aaa] bg-[#ff7aaa] text-white shadow-[0_14px_28px_rgba(255,122,170,0.3)]"
                    : "border-[#ffd6e8] bg-white text-[#3a2530] hover:border-[#ff7aaa]",
                )}
              >
                <span className="block text-2xl" aria-hidden>
                  {option.icon}
                </span>
                <span className="mt-1 block text-lg font-black leading-tight">
                  {option.label}
                </span>
                <span
                  className={cn(
                    "mt-1 block text-sm font-bold leading-tight",
                    selectedTime === option.value ? "text-white/85" : "text-[#8a6a78]",
                  )}
                >
                  {option.note}
                </span>
              </button>
            );
          })}
          {availablePresetOptions.length === 0 ? (
            <div className="col-span-2 rounded-[22px] border-2 border-dashed border-[#ffd6e8] bg-white/70 px-4 py-5 text-center text-sm font-black text-[#8a6a78]">
              The presets already passed, but custom time still has us.
            </div>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowCustom((value) => !value)}
        className="mt-4 min-h-14 w-full rounded-full border-2 border-[#c7a6ff] bg-white/80 px-5 py-3 font-black text-[#6b4ab0] shadow-sm outline-none focus-visible:ring-4 focus-visible:ring-[#e7d9ff]"
      >
        {showCustom ? "hide custom time" : "pick a custom time"}
      </button>

      {showCustom ? (
        <div className="mt-4 rounded-[30px] border-2 border-[#ffd6e8] bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,247,251,0.92),rgba(231,217,255,0.58))] p-4 text-left shadow-[0_14px_34px_rgba(199,166,255,0.16)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6a78]">
              custom time
            </p>
            <p className="text-2xl font-black leading-tight text-[#3a2530]">
              {selectedTimeLabel(effectiveCustomValue)}
            </p>
          </div>
          <span className="grid h-13 w-13 place-items-center rounded-[22px] border-2 border-white bg-[#fff7fb] text-2xl shadow-inner">
            🕰️
          </span>
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-black uppercase tracking-[0.16em] text-[#8a6a78]">
            pick exact time
          </label>
          <div className="relative">
            <select
              value={effectiveCustomValue}
              onChange={(event) => setCustomValue(event.target.value)}
              className="min-h-16 w-full appearance-none rounded-[24px] border-2 border-[#ffb6d5] bg-white/95 px-5 pr-14 text-center text-xl font-black text-[#3a2530] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_24px_rgba(255,122,170,0.12)] outline-none transition hover:border-[#ff7aaa] focus-visible:border-[#ff7aaa] focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
              aria-label="Custom time"
            >
              {customTimeOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  className="bg-[#fff7fb] font-bold text-[#3a2530]"
                >
                  {option.label}
                </option>
              ))}
            </select>
            <span
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-2xl bg-[#ffd6e8] text-lg font-black text-[#7c3653] shadow-inner"
            >
              ˅
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelect(effectiveCustomValue, customLabel)}
          className="mt-4 min-h-13 w-full rounded-full bg-[#c7a6ff] px-5 py-3 font-black text-white shadow-[0_12px_24px_rgba(199,166,255,0.28)] outline-none transition focus-visible:ring-4 focus-visible:ring-[#e7d9ff]"
        >
          use this time
        </button>
      </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3 rounded-[22px] bg-[#fff7fb] px-4 py-3">
        <div className="text-left">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8a6a78]">
            selected time
          </p>
          <p className="text-xl font-black text-[#3a2530]">
            {selectedOption?.label ?? selectedTimeLabel(selectedTime) ?? "not yet"}
          </p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-2xl">
          {selectedOption?.icon ?? "💗"}
        </span>
      </div>

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
          disabled={!selectedTime}
          onClick={onNext}
          className="min-h-14 rounded-full bg-[#ff7aaa] px-5 py-3 font-black text-white shadow-[0_14px_30px_rgba(255,122,170,0.32)] outline-none transition disabled:cursor-not-allowed disabled:bg-[#ffd6e8] disabled:text-[#8a6a78] focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
        >
          continue
        </button>
      </div>
    </StepCard>
  );
}

function toDateValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function selectedTimeLabel(value: string | null) {
  if (!value) {
    return null;
  }

  const [hour, minute] = value.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

function getCustomTimeOptions(isToday: boolean, nowMinutes: number) {
  const options = [];

  for (let minutes = 0; minutes < 24 * 60; minutes += 15) {
    if (isToday && minutes <= nowMinutes) {
      continue;
    }

    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    options.push({
      value,
      label: selectedTimeLabel(value) ?? value,
    });
  }

  return options;
}
