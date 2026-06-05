"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDateLabel } from "@/lib/date-options";
import { cn } from "@/lib/utils";
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
  const [showCalendar, setShowCalendar] = useState(!selectedDate);
  const calendarDays = useMemo(
    () => getCalendarMonthDays(visibleMonth, today),
    [today, visibleMonth],
  );
  const dateSuggestions = useMemo(() => getDateSuggestions(), []);
  const [hoverBubble, setHoverBubble] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
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
      subtitle="A quick pick is cute. The calendar is here if we need real availability."
    >
      <div className="mb-3 grid gap-3">
        {dateSuggestions.map((suggestion) => (
          <button
            key={`${suggestion.title}-${suggestion.value}`}
            type="button"
            onClick={() => onSelect(suggestion.value, formatDateLabel(suggestion.value))}
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
              <span className="block text-lg font-black">{suggestion.title}</span>
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
      </div>
      {selectedDate ? (
        <button
          type="button"
          onClick={() => setShowCalendar((value) => !value)}
          className="mb-3 min-h-14 w-full rounded-full border-2 border-[#c7a6ff] bg-white/80 px-5 py-3 font-black text-[#6b4ab0] shadow-sm outline-none focus-visible:ring-4 focus-visible:ring-[#e7d9ff]"
        >
          {showCalendar ? "hide Cute Cal" : "pick a different day"}
        </button>
      ) : null}
      {showCalendar ? (
        <div className="rounded-[26px] border-2 border-[#ffd6e8] bg-white/80 p-4 shadow-sm">
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
        <div className="mb-3 flex justify-center">
          <div className="rounded-full bg-[#fff3d6] px-3 py-1 text-sm font-black text-[#7a5a11]">
            {selectedLabel ?? "choose one"}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-black uppercase tracking-[0.08em] text-[#8a6a78]">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <span key={`${day}-${index}`} className="py-1">
              {day}
            </span>
          ))}
        </div>
        <div className="relative mt-1 grid grid-cols-7 gap-1.5">
          {calendarDays.map((day) => (
            <div key={day.key} className="relative">
              {day.value ? (
                <button
                  type="button"
                  disabled={day.isPast}
                  onMouseEnter={(event) => {
                    if (day.isFarFuture) {
                      setHoverBubble({
                        text: farFutureLines[day.date % farFutureLines.length],
                        x: event.clientX,
                        y: event.clientY,
                      });
                    }
                  }}
                  onMouseMove={(event) => {
                    if (day.isFarFuture) {
                      setHoverBubble((current) =>
                        current
                          ? {
                              ...current,
                              x: event.clientX,
                              y: event.clientY,
                            }
                          : {
                              text: farFutureLines[day.date % farFutureLines.length],
                              x: event.clientX,
                              y: event.clientY,
                            },
                      );
                    }
                  }}
                  onMouseLeave={() => setHoverBubble(null)}
                  onFocus={() => {
                    if (day.isFarFuture) {
                      setHoverBubble({
                        text: farFutureLines[day.date % farFutureLines.length],
                        x:
                          typeof window === "undefined"
                            ? 300
                            : window.innerWidth - 130,
                        y: 88,
                      });
                    }
                  }}
                  onBlur={() => setHoverBubble(null)}
                  onClick={() => onSelect(day.value, formatDateLabel(day.value))}
                  className={cn(
                    "relative grid aspect-square min-h-10 place-items-center rounded-2xl border-2 text-sm font-black outline-none transition focus-visible:ring-4 focus-visible:ring-[#ffd6e8] disabled:cursor-not-allowed disabled:opacity-35",
                    selectedDate === day.value
                      ? "border-[#ff7aaa] bg-[#ff7aaa] text-white shadow-[0_12px_24px_rgba(255,122,170,0.32)]"
                      : day.isWeekend
                        ? "border-[#ffd6e8] bg-[#fff7fb] text-[#3a2530]"
                        : "border-white bg-white text-[#3a2530] hover:border-[#ffd6e8]",
                  )}
                  aria-label={formatDateLabel(day.value)}
                >
                  {day.date}
                  {day.isWeekend ? (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute bottom-1 h-1 w-1 rounded-full",
                        selectedDate === day.value ? "bg-white" : "bg-[#ff7aaa]",
                      )}
                    />
                  ) : null}
                </button>
              ) : (
                <span aria-hidden className="block aspect-square min-h-10" />
              )}
            </div>
          ))}
        </div>
        </div>
      ) : null}
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
      <AnimatePresence>
        {hoverBubble ? (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.94 }}
            className="pointer-events-none fixed z-40 w-52 rounded-[22px] border-2 border-[#ffd6e8] bg-white px-4 py-3 text-center text-sm font-black leading-tight text-[#8a6a78] shadow-[0_12px_28px_rgba(255,122,170,0.2)] after:absolute after:left-[-7px] after:top-1/2 after:h-3 after:w-3 after:-translate-y-1/2 after:rotate-45 after:border-b-2 after:border-l-2 after:border-[#ffd6e8] after:bg-white"
            style={{
              left:
                typeof window === "undefined"
                  ? hoverBubble.x + 56
                  : Math.min(hoverBubble.x + 56, window.innerWidth - 230),
              top: Math.max(18, hoverBubble.y - 22),
            }}
          >
            {hoverBubble.text}
          </motion.div>
        ) : null}
      </AnimatePresence>
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

function getDateSuggestions() {
  const today = getToday();
  const shortFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const priorityDays = getPriorityDateSuggestions(today);

  return [
    {
      title: "You want to see me now?",
      subtitle: `Today, ${shortFormatter.format(today)} - bold and adorable`,
      value: toDateValue(today),
      icon: "💌",
    },
    ...priorityDays.map((date, index) => ({
      title: index === 0 ? "Soon would be cute" : "Plan something special",
      subtitle:
        index === 0
          ? `${shortFormatter.format(date)} - little butterflies`
          : `${shortFormatter.format(date)} - weekend energy`,
      value: toDateValue(date),
      icon: index === 0 ? "✨" : "🌷",
    })),
  ];
}

function getPriorityDateSuggestions(today: Date) {
  const priorityWeekdays = new Set([5, 6, 0]);
  const suggestions: Date[] = [];

  for (let offset = 1; suggestions.length < 2 && offset <= 21; offset += 1) {
    const date = addDays(today, offset);

    if (priorityWeekdays.has(date.getDay())) {
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
    isWeekend: false,
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
      isWeekend: date.getDay() === 5 || date.getDay() === 6 || date.getDay() === 0,
    };
  });

  return [...blanks, ...days];
}
