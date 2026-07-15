import type { ItineraryJson } from "./db/schema";
import { formatTime, parseTimeToMinutes } from "./datetime";
import { ACTIVITY_ICONS, DEFAULT_STOP_DURATIONS } from "./venues";

export type ItineraryInput = {
  selectedDateLabel: string | null;
  selectedTimeLabel: string | null;
  /** "HH:MM" — drives the deterministic timeline's projected times. */
  selectedTime?: string | null;
  selectedEntree: string | null;
  selectedActivities: string[];
  selectedEntreeVenue?: { name: string; address: string } | null;
  selectedActivityVenues?: Record<string, { name: string; address: string }>;
  /** Normalized lineup. When present, this order and these durations win. */
  orderedStops?: ItineraryStopInput[];
};

export type ItineraryStopInput = {
  key: string;
  label: string;
  durationMinutes: number;
  venue: { name: string; address: string } | null;
};

/** One canonical stop the itinerary must cover — nothing more, nothing less. */
export type ItineraryStop = {
  /** Duration/icon lookup key ("Coffee", "__entree__", …). */
  key: string;
  /** Display name ("Coffee", or the entree like "Tacos"). */
  label: string;
  emoji: string;
  venue: { name: string; address: string } | null;
  durationMinutes: number;
};

const ENTREE_KEY = "__entree__";

/** The exact stops a plan's itinerary must contain, in lineup order. */
export function buildItineraryStops(input: ItineraryInput): ItineraryStop[] {
  if (input.orderedStops && input.orderedStops.length > 0) {
    return input.orderedStops.map((stop) => ({
      ...stop,
      emoji: stop.key === ENTREE_KEY ? "🍽️" : (ACTIVITY_ICONS[stop.key] ?? "✨"),
    }));
  }

  const stops: ItineraryStop[] = input.selectedActivities.map((act) => ({
    key: act,
    label: act,
    emoji: ACTIVITY_ICONS[act] ?? "✨",
    venue: input.selectedActivityVenues?.[act] ?? null,
    durationMinutes: DEFAULT_STOP_DURATIONS[act] ?? 60,
  }));
  if (input.selectedEntree && input.selectedEntree !== "Surprise me") {
    stops.push({
      key: ENTREE_KEY,
      label: input.selectedEntree,
      emoji: "🍽️",
      venue: input.selectedEntreeVenue ?? null,
      durationMinutes: DEFAULT_STOP_DURATIONS[ENTREE_KEY] ?? 60,
    });
  }
  return stops;
}

/**
 * E1: the timeline we can always trust — one entry per selected stop, in
 * order, with times projected from the default stop durations.
 */
export function deterministicTimeline(
  stops: ItineraryStop[],
  startMinutes: number,
): ItineraryJson["timeline"] {
  let t = startMinutes;
  return stops.map((stop) => {
    const entry = {
      time: formatTime(t),
      emoji: stop.emoji,
      activity: stop.venue ? `${stop.label} at ${stop.venue.name}` : stop.label,
      note: stop.venue ? stop.venue.address : "",
    };
    t += stop.durationMinutes;
    return entry;
  });
}

/**
 * E1/E2: force whatever Gemini returned back onto the real plan.
 *
 * The timeline is ALWAYS the deterministic one (N stops in → N entries out,
 * venue names verbatim); Gemini only contributes the playful `note` for
 * entries we can confidently match to a stop. Hallucinated stops ("Cozy
 * Corner coffee and chat") match nothing, so their notes are dropped. Tips
 * are kept only when they mention an actual stop or venue, capped at 3.
 */
export function sanitizeItinerary(raw: unknown, input: ItineraryInput): ItineraryJson {
  const stops = buildItineraryStops(input);
  const timeline = deterministicTimeline(stops, parseTimeToMinutes(input.selectedTime ?? null));

  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<ItineraryJson>;

  // Merge Gemini's notes onto matching stops (each stop claims at most one entry).
  const entries = Array.isArray(obj.timeline) ? obj.timeline : [];
  const claimed = new Set<number>();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const activity = typeof entry.activity === "string" ? entry.activity : "";
    const note = typeof entry.note === "string" ? entry.note.trim() : "";
    if (!note) continue;
    const text = `${activity} ${note}`;
    const i = stops.findIndex((s, idx) => !claimed.has(idx) && entryMatchesStop(text, s));
    if (i >= 0) {
      claimed.add(i);
      timeline[i] = { ...timeline[i], note };
    }
  }

  const tips = (Array.isArray(obj.tips) ? obj.tips : [])
    .filter((tip): tip is string => typeof tip === "string" && tipMentionsStops(tip, stops))
    .slice(0, 3);

  return {
    title:
      typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : "Your Date Night",
    summary: typeof obj.summary === "string" ? obj.summary.trim() : "",
    timeline,
    tips,
  };
}

/**
 * A timeline entry belongs to a stop only if it names it: the chosen venue
 * when there is one (so invented venues can't ride along on a generic
 * activity name), otherwise the activity label.
 */
function entryMatchesStop(text: string, stop: ItineraryStop): boolean {
  const target = stop.venue?.name ?? stop.label;
  return normalize(text).includes(normalize(target));
}

/** E2: a tip must mention one of the real stops or venues by name. */
function tipMentionsStops(tip: string, stops: ItineraryStop[]): boolean {
  const tipWords = significantWords(tip);
  return stops.some((stop) =>
    [...significantWords(stop.label), ...(stop.venue ? significantWords(stop.venue.name) : [])]
      .some((w) => tipWords.has(w)),
  );
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function significantWords(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter((w) => w.length >= 4));
}

export async function generateItinerary(
  input: ItineraryInput,
): Promise<ItineraryJson | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const prompt = buildItineraryPrompt(input);

  let response: Response;
  try {
    response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 800,
            responseMimeType: "application/json",
            // 3.1 Flash Lite is a thinking model; disable it so the whole token
            // budget goes to output (otherwise reasoning can truncate the JSON).
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  const text =
    payload?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text)
      .filter(Boolean)
      .join("") ?? "";

  try {
    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    // E1: never trust the raw response — pin it to the selected stops.
    return sanitizeItinerary(JSON.parse(cleaned), input);
  } catch {
    return null;
  }
}

function buildItineraryPrompt(input: ItineraryInput) {
  const stops = buildItineraryStops(input);
  const stopLines = stops.map(
    (s, i) =>
      `${i + 1}. ${s.label}${s.venue ? ` at ${s.venue.name}, ${s.venue.address}` : ""}`,
  );

  return [
    'Return JSON only in this exact shape: {"title":"string","summary":"one romantic sentence","timeline":[{"time":"H:MM PM","emoji":"emoji","activity":"short name","note":"1-sentence tip or detail"}],"tips":["short tip"]}.',
    "You are writing a romantic date night itinerary.",
    `Use EXACTLY these ${stops.length} stops, in this order — do not add, remove, or rename venues:`,
    ...stopLines,
    `The timeline must have exactly ${stops.length} entries, one per stop above, in the same order.`,
    "Each entry has a realistic time, one emoji, a short activity name, and a playful 1-sentence note specific to that stop.",
    "When a venue name and address are given, use the venue name verbatim in the activity name.",
    "tips: at most 3, each about a specific stop above — logistics like parking, reservations, or sunset timing — and each must mention that stop or venue by name. No generic advice.",
    "Keep the tone warm, playful, and slightly romantic.",
    `Date: ${input.selectedDateLabel ?? "upcoming"}.`,
    `Start time: ${input.selectedTimeLabel ?? "evening"}.`,
  ].join("\n");
}
