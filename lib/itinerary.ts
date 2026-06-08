import type { ItineraryJson } from "./db/schema";

type ItineraryInput = {
  selectedDateLabel: string | null;
  selectedTimeLabel: string | null;
  selectedEntree: string | null;
  selectedActivities: string[];
  selectedEntreeVenue?: { name: string; address: string } | null;
  selectedActivityVenues?: Record<string, { name: string; address: string }>;
};

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
    return JSON.parse(cleaned) as ItineraryJson;
  } catch {
    return null;
  }
}

function buildItineraryPrompt({
  selectedDateLabel,
  selectedTimeLabel,
  selectedEntree,
  selectedActivities,
  selectedEntreeVenue,
  selectedActivityVenues,
}: ItineraryInput) {
  const dinnerLine = selectedEntreeVenue
    ? `Dinner: ${selectedEntree} at ${selectedEntreeVenue.name}, ${selectedEntreeVenue.address}.`
    : `Dinner: ${selectedEntree ?? "dinner"}.`;

  const activityLines = selectedActivities
    .map((act) => {
      const venue = selectedActivityVenues?.[act];
      return venue ? `${act} at ${venue.name}, ${venue.address}` : act;
    })
    .join(" and ");

  return [
    'Return JSON only in this exact shape: {"title":"string","summary":"one romantic sentence","timeline":[{"time":"H:MM PM","emoji":"emoji","activity":"short name","note":"1-sentence tip or detail"}],"tips":["short tip","short tip"]}.',
    "Create a detailed, romantic date night itinerary with 4-6 timeline entries.",
    "The timeline should flow naturally from arrival time through dinner and activities.",
    "Each entry has a realistic time, one emoji, a short activity name, and a brief note.",
    "When a real venue name and address are given, use them verbatim in the activity name and note.",
    "Tips should be thoughtful, practical suggestions (reservation reminder, vibe tip, etc).",
    "Keep the tone warm, playful, and slightly romantic. No generic advice.",
    `Date: ${selectedDateLabel ?? "upcoming"}.`,
    `Start time: ${selectedTimeLabel ?? "evening"}.`,
    dinnerLine,
    `Activities: ${activityLines || "a fun evening"}.`,
  ].join("\n");
}
