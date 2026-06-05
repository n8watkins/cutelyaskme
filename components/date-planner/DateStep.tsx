"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDateLabel } from "@/lib/date-options";
import { cn } from "@/lib/utils";
import { HoverBubble, type HoverBubbleState } from "./HoverBubble";
import { StepCard } from "./StepCard";

type DateStepProps = {
  selectedDate: string | null;
  onSelect: (value: string, label: string) => void;
  onNext: () => void;
  onBack: () => void;
};

export function DateStep({
  selectedDate,
  onSelect,
  onNext,
  onBack,
}: DateStepProps) {
  const today = useMemo(() => getToday(), []);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarDays = useMemo(
    () => getCalendarMonthDays(visibleMonth, today),
    [today, visibleMonth],
  );
  const dateSuggestions = useMemo(() => getDateSuggestions(), []);
  const [hoverBubble, setHoverBubble] = useState<HoverBubbleState>(null);
  const selectedLabel = selectedDate ? formatDateLabel(selectedDate) : null;
  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <StepCard
      stickerSrc="/assets/calendar-heart.svg"
      stickerAlt="Pastel calendar with heart"
      eyebrow="step one"
      title="What day feels sweet?"
      subtitle="Weeks are busy, so Friday, Saturday, and Sunday are the open doors."
    >
      <div className="relative mb-4 min-h-[370px] overflow-hidden">
        <AnimatePresence mode="wait">
          {showCalendar ? (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 rounded-[26px] border-2 border-[#ffd6e8] bg-white/80 p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
                  className="grid h-11 w-11 place-items-center rounded-full border-2 border-[#ffd6e8] bg-white text-xl font-black text-[#8a6a78] outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6a78]">
                    Cute Cal
                  </p>
                  <p className="text-2xl font-black text-[#3a2530]">
                    {monthFormatter.format(visibleMonth)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
                  className="grid h-11 w-11 place-items-center rounded-full border-2 border-[#ffd6e8] bg-white text-xl font-black text-[#8a6a78] outline-none focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-black uppercase tracking-[0.08em] text-[#8a6a78]">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                  <span key={`${day}-${index}`} className="py-1">
                    {day}
                  </span>
                ))}
              </div>
              <div className="relative mt-1 grid grid-cols-7 gap-1.5">
                {calendarDays.map((day) => {
                  const unavailable = day.isPast || !day.isAvailable;

                  return (
                    <div key={day.key} className="relative">
                      {day.value ? (
                        <button
                          type="button"
                          aria-disabled={unavailable}
                          onMouseEnter={(event) => {
                            setHoverBubble({
                              text: getDateHoverLine(day),
                              x: event.clientX,
                              y: event.clientY,
                            });
                          }}
                          onMouseMove={(event) => {
                            setHoverBubble((current) =>
                              current
                                ? {
                                    ...current,
                                    x: event.clientX,
                                    y: event.clientY,
                                  }
                                : {
                                    text: getDateHoverLine(day),
                                    x: event.clientX,
                                    y: event.clientY,
                                  },
                            );
                          }}
                          onMouseLeave={() => setHoverBubble(null)}
                          onFocus={() => {
                            setHoverBubble({
                              text: getDateHoverLine(day),
                              x:
                                typeof window === "undefined"
                                  ? 300
                                  : window.innerWidth - 130,
                              y: 88,
                            });
                          }}
                          onBlur={() => setHoverBubble(null)}
                          onClick={() => {
                            if (!unavailable) {
                              onSelect(day.value, formatDateLabel(day.value));
                            }
                          }}
                          className={cn(
                            "relative grid h-8 place-items-center rounded-2xl border-2 text-sm font-black outline-none transition focus-visible:ring-4 focus-visible:ring-[#ffd6e8] sm:h-9",
                            unavailable
                              ? "cursor-not-allowed border-white bg-white/65 text-[#c3a5b2] opacity-55"
                              : selectedDate === day.value
                                ? "border-[#ff7aaa] bg-[#ff7aaa] text-white shadow-[0_12px_24px_rgba(255,122,170,0.32)]"
                                : "border-[#ffd6e8] bg-[#fff7fb] text-[#3a2530] hover:border-[#ff7aaa]",
                          )}
                          aria-label={formatDateLabel(day.value)}
                        >
                          {day.date}
                          {day.isAvailable && !day.isPast ? (
                            <span
                              aria-hidden
                              className={cn(
                                "absolute bottom-1 h-1 w-1 rounded-full",
                                selectedDate === day.value
                                  ? "bg-white"
                                  : "bg-[#ff7aaa]",
                              )}
                            />
                          ) : null}
                        </button>
                      ) : (
                        <span aria-hidden className="block h-8 sm:h-9" />
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="suggestions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 grid content-start gap-3"
            >
              {dateSuggestions.map((suggestion) => (
                <button
                  key={`${suggestion.title}-${suggestion.value}`}
                  type="button"
                  onClick={() =>
                    onSelect(suggestion.value, formatDateLabel(suggestion.value))
                  }
                  className={cn(
                    "flex min-h-16 items-center gap-3 rounded-[22px] border-2 p-4 text-left outline-none transition focus-visible:ring-4 focus-visible:ring-[#ffd6e8]",
                    selectedDate === suggestion.value
                      ? "border-[#ff7aaa] bg-[#ff7aaa] text-white shadow-[0_12px_24px_rgba(255,122,170,0.28)]"
                      : "border-[#ffd6e8] bg-white/80 text-[#3a2530] hover:border-[#ff7aaa]",
                  )}
                >
                  <span
                    aria-hidden
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/55 text-2xl"
                  >
                    {suggestion.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg font-black">
                      {suggestion.title}
                    </span>
                    <span
                      className={cn(
                        "mt-1 block text-sm font-bold",
                        selectedDate === suggestion.value
                          ? "text-white/85"
                          : "text-[#8a6a78]",
                      )}
                    >
                      {suggestion.subtitle}
                    </span>
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowCalendar(true)}
                className="min-h-14 w-full rounded-full border-2 border-[#c7a6ff] bg-white/80 px-5 py-3 font-black text-[#6b4ab0] shadow-sm outline-none focus-visible:ring-4 focus-visible:ring-[#e7d9ff]"
              >
                open Cute Cal
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="rounded-[26px] border-2 border-[#ffd6e8] bg-white/90 px-5 py-4 text-center shadow-[0_14px_30px_rgba(255,122,170,0.14)]">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8a6a78]">
          selected date
        </p>
        <p className="mt-1 text-3xl font-black leading-tight text-[#3a2530]">
          {selectedLabel ?? "pick a weekend"}
        </p>
        {showCalendar ? (
          <button
            type="button"
            onClick={() => setShowCalendar(false)}
            className="mt-3 min-h-10 rounded-full border-2 border-[#c7a6ff] bg-white px-4 text-sm font-black text-[#6b4ab0] outline-none focus-visible:ring-4 focus-visible:ring-[#e7d9ff]"
          >
            back to quick picks
          </button>
        ) : null}
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
          disabled={!selectedDate}
          onClick={onNext}
          className="min-h-14 rounded-full bg-[#ff7aaa] px-5 py-3 font-black text-white shadow-[0_14px_30px_rgba(255,122,170,0.32)] outline-none transition disabled:cursor-not-allowed disabled:bg-[#ffd6e8] disabled:text-[#8a6a78] focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
        >
          continue
        </button>
      </div>
      <HoverBubble bubble={hoverBubble} />
    </StepCard>
  );
}

const farFutureLines = [
  "don't you want to see me sooner?",
  "that's so far away, I might get dramatic",
  "my calendar just sighed",
  "okay future planner",
  "what if we missed each other sooner?",
  "two weeks is basically a novel",
  "I can be patient, allegedly",
  "that gives me time to overthink my outfit",
  "cute, but sooner is cuter",
  "are we scheduling with a telescope?",
  "my heart prefers the express lane",
  "bold of you to make me wait",
] as const;

const availableDateLines = [
  "this one has date-night potential",
  "weekend energy, approved",
  "I could make this one very cute",
  "this square is giving butterflies",
  "yes, this is an open-door day",
  "that day could be our little plan",
] as const;

const busyWeekLines = [
  "weekday me is booked and dramatic",
  "the workweek said no, rude",
  "busy-week territory, save me for the weekend",
  "this one is cute but not available",
] as const;

const pastDateLines = [
  "that one already slipped away",
  "too late, but the weekend is calling",
  "past-tense date plans are not our lane",
] as const;

type CalendarDay = ReturnType<typeof getCalendarMonthDays>[number];

function getDateHoverLine(day: CalendarDay) {
  if (day.isPast) {
    return pastDateLines[day.date % pastDateLines.length];
  }

  if (!day.isAvailable) {
    return busyWeekLines[day.date % busyWeekLines.length];
  }

  if (day.isFarFuture) {
    return farFutureLines[day.date % farFutureLines.length];
  }

  return availableDateLines[day.date % availableDateLines.length];
}

function getDateSuggestions() {
  const today = getToday();
  const shortFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const priorityDays = getPriorityDateSuggestions(today, 3);

  return priorityDays.map((date, index) => ({
    title:
      index === 0
        ? isSameDate(date, today)
          ? "Today is actually open"
          : "Soon would be cute"
        : index === 1
          ? "Weekend energy"
          : "Plan something special",
    subtitle:
      index === 0
        ? `${shortFormatter.format(date)} - little butterflies`
        : `${shortFormatter.format(date)} - weekend-only window`,
    value: toDateValue(date),
    icon: index === 0 ? "✨" : index === 1 ? "🌷" : "💌",
  }));
}

function getPriorityDateSuggestions(today: Date, count: number) {
  const suggestions: Date[] = [];

  for (let offset = 0; suggestions.length < count && offset <= 28; offset += 1) {
    const date = addDays(today, offset);

    if (isAvailableDate(date)) {
      suggestions.push(date);
    }
  }

  return suggestions;
}

function toDateValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getToday() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return today;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1, 12, 0, 0, 0);
}

function isSameDate(first: Date, second: Date) {
  return toDateValue(first) === toDateValue(second);
}

function isAvailableDate(date: Date) {
  return date.getDay() === 5 || date.getDay() === 6 || date.getDay() === 0;
}

function getCalendarMonthDays(visibleMonth: Date, today: Date) {
  const firstDay = startOfMonth(visibleMonth);
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate();
  const blanks = Array.from({ length: firstDay.getDay() }, (_, index) => ({
    key: `blank-${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}-${index}`,
    value: null,
    date: 0,
    isPast: false,
    isAvailable: false,
    isFarFuture: false,
  }));
  const farFutureStart = addDays(today, 14);

  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      index + 1,
      12,
      0,
      0,
      0,
    );

    const value = toDateValue(date);

    return {
      key: value,
      value,
      date: date.getDate(),
      isPast: date < today,
      isFarFuture: date > farFutureStart,
      isAvailable: isAvailableDate(date),
    };
  });

  return [...blanks, ...days];
}
