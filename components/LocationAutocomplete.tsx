"use client";

import { useEffect, useRef, useState } from "react";
import type { AutocompleteSuggestion } from "@/app/api/autocomplete/route";
import type { PlaceGeo } from "@/app/api/place-geo/route";

type Props = {
  value: string;
  onChange: (text: string) => void;
  /** Fires when a suggestion is picked and resolved to coordinates. */
  onSelect: (geo: PlaceGeo) => void;
  /** Fires on Enter with free text (no suggestion picked) — the legacy geocode path. */
  onSubmitText?: () => void;
  placeholder?: string;
  inputClassName: string;
};

/**
 * Google Places autocomplete-as-you-type, proxied through /api/autocomplete.
 * One session token per typing burst (Google's session pricing: keystrokes are
 * free once the session terminates in /api/place-geo). Falls back silently to
 * plain text entry when the API is unavailable.
 */
export function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  onSubmitText,
  placeholder,
  inputClassName,
}: Props) {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const sessionRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function handleInput(text: string) {
    onChange(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => void fetchSuggestions(text.trim()), 250);
  }

  async function fetchSuggestions(q: string) {
    sessionRef.current ??= crypto.randomUUID();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(
        `/api/autocomplete?q=${encodeURIComponent(q)}&session=${sessionRef.current}`,
        { signal: controller.signal },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { suggestions: AutocompleteSuggestion[] };
      setSuggestions(data.suggestions);
      setOpen(data.suggestions.length > 0);
      setActive(-1);
    } catch {}
  }

  async function pick(s: AutocompleteSuggestion) {
    setOpen(false);
    setSuggestions([]);
    const session = sessionRef.current;
    sessionRef.current = null; // the resolve call terminates this session
    onChange(s.secondary ? `${s.main}, ${s.secondary}` : s.main);
    try {
      const res = await fetch(
        `/api/place-geo?id=${encodeURIComponent(s.placeId)}${session ? `&session=${session}` : ""}`,
      );
      if (!res.ok) return;
      const geo = (await res.json()) as PlaceGeo;
      onSelect(geo);
    } catch {}
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter") {
        setOpen(false);
        onSubmitText?.();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      void pick(suggestions[active >= 0 ? active : 0]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={`w-full ${inputClassName}`}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && (
        <ul className="absolute left-0 right-0 top-full z-[1200] mt-1 overflow-hidden rounded-2xl border-2 border-[#ffd6e8] bg-white shadow-lg">
          {suggestions.map((s, i) => (
            <li key={s.placeId}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()} // keep input focus
                onClick={() => void pick(s)}
                onMouseEnter={() => setActive(i)}
                className={`block w-full px-3 py-2 text-left transition ${
                  i === active ? "bg-[#fff7fb]" : "bg-white"
                }`}
              >
                <span className="block truncate text-sm font-black text-[#3a2530]">📍 {s.main}</span>
                {s.secondary && (
                  <span className="block truncate pl-5 text-xs text-[#8a6a78]">{s.secondary}</span>
                )}
              </button>
            </li>
          ))}
          <li className="border-t border-[#fff0f6] px-3 py-1 text-right text-[9px] text-[#c0a0b0]">
            powered by Google
          </li>
        </ul>
      )}
    </div>
  );
}
