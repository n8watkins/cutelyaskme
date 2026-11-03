"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  describeTimeZone,
  searchTimeZones,
  supportedTimeZones,
  timeZoneLabel,
  type TimeZoneOption,
} from "@/lib/timezones";

type TimeZoneFieldProps = {
  /**
   * The chosen IANA zone. `null` while the device zone is still being read
   * (first client render), "" when it could not be detected.
   */
  value: string | null;
  onChange: (zone: string) => void;
  /** Where the sender said the date is, shown as a hint. */
  location?: string | null;
  /** True when `value` came from the browser rather than a manual pick. */
  detected: boolean;
};

// The date's timezone defaults to the device's own zone and reads as one
// quiet line. "Change" opens a small search (city, zone name or offset)
// instead of a 420-entry list of raw IANA ids.
export function TimeZoneField({ value, onChange, location, detected }: TimeZoneFieldProps) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const labelId = useId();

  const current = useMemo(() => (value ? describeTimeZone(value) : null), [value]);
  const open = value !== null && (editing || !value);
  // Describing ~420 zones costs a few hundred Intl formatters, so only do it
  // once the search is actually open.
  const options = useMemo<TimeZoneOption[]>(() => {
    if (!open) return [];
    const now = new Date();
    return supportedTimeZones().map((zone) => describeTimeZone(zone, now));
  }, [open]);
  const results = useMemo(() => searchTimeZones(query, options), [query, options]);

  function choose(option: TimeZoneOption) {
    onChange(option.id);
    setEditing(false);
    setQuery("");
    setActiveIndex(0);
  }

  function startEditing() {
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className="mt-4 rounded-[24px] border-2 border-[#e7d9ff] bg-white/90 p-4 text-left shadow-sm">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f5f0ff] text-2xl shadow-inner"
        >
          🌍
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-h-6 items-center justify-between gap-2">
            <p
              id={labelId}
              className="text-xs font-black uppercase tracking-[0.16em] text-[#8a6a78]"
            >
              Date timezone
            </p>
            {current && !editing && (
              <button
                type="button"
                onClick={startEditing}
                className="-my-2.5 -mr-2 min-h-11 shrink-0 rounded-full px-3 text-sm font-black text-[#6b4a99] underline decoration-2 underline-offset-4 outline-none transition hover:bg-[#f5f0ff] focus-visible:ring-4 focus-visible:ring-[#e7d9ff]"
                aria-label="Change the date timezone"
              >
                Change
              </button>
            )}
          </div>
          {current ? (
            <p className="mt-1 text-lg font-black leading-snug text-[#3a2530]" data-testid="timezone-value">
              {timeZoneLabel(current)}
            </p>
          ) : value === null ? (
            <p className="mt-1 text-sm font-bold text-[#8a6a78]" aria-live="polite">
              Checking your timezone…
            </p>
          ) : (
            <p className="mt-1 text-sm font-bold text-[#8a6a78]">
              Pick the city where the date happens.
            </p>
          )}
          {current && (
            <p className="mt-1 text-xs font-bold leading-relaxed text-[#8a6a78]">
              {current.offset} · {detected ? "from your device" : "picked by you"}
              {location ? `. The date is near ${location}.` : "."}
            </p>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3">
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-labelledby={labelId}
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            autoComplete="off"
            placeholder="Search a city, like Chicago or Paris"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (event.key === "Enter" && results[activeIndex]) {
                event.preventDefault();
                choose(results[activeIndex]);
              } else if (event.key === "Escape" && value) {
                setEditing(false);
                setQuery("");
              }
            }}
            className="min-h-12 w-full rounded-2xl border-2 border-[#ffd6e8] bg-white px-4 text-base font-bold text-[#3a2530] outline-none placeholder:text-[#a08490] focus-visible:ring-4 focus-visible:ring-[#e7d9ff]"
          />
          <ul id={listId} role="listbox" aria-labelledby={labelId} className="mt-2 grid gap-1">
            {results.map((option, index) => (
              <li
                key={option.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm font-black text-[#3a2530] ${
                  index === activeIndex ? "bg-[#f5f0ff]" : "hover:bg-[#fff7fb]"
                }`}
              >
                <span className="min-w-0 truncate">
                  {timeZoneLabel(option)}
                  {option.region ? (
                    <span className="font-bold text-[#8a6a78]"> · {option.region}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs font-bold text-[#8a6a78]">{option.offset}</span>
              </li>
            ))}
          </ul>
          {query.trim() && results.length === 0 && (
            <p className="mt-2 text-sm font-bold text-[#8a6a78]">
              No match. Try the nearest big city.
            </p>
          )}
          {value && (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setQuery("");
              }}
              className="mt-2 min-h-11 text-sm font-black text-[#6b4a99] underline-offset-4 hover:underline"
            >
              Keep {current ? current.city : "the current zone"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
