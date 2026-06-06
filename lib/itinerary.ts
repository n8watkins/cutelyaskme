import type { ItineraryJson } from "./db/schema";

type ItineraryInput = {
  selectedDateLabel: string | null;
  selectedTimeLabel: string | null;
  selectedEntree: string | null;
  selectedActivities: string[];
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
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
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
            maxOutputTokens: 600,
            responseMimeType: "application/json",
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
}: ItineraryInput) {
  return [
    'Return JSON only in this exact shape: {"title":"string","summary":"one romantic sentence","timeline":[{"time":"H:MM PM","emoji":"emoji","activity":"short name","note":"1-sentence tip or detail"}],"tips":["short tip","short tip"]}.',
    "Create a detailed, romantic date night itinerary with 4-6 timeline entries.",
    "The timeline should flow naturally from arrival time through dinner and activities.",
    "Each entry has a realistic time, one emoji, a short activity name, and a brief note.",
    "Tips should be thoughtful, practical suggestions (reservation reminder, vibe tip, etc).",
    "Keep the tone warm, playful, and slightly romantic. No generic advice.",
    `Date: ${selectedDateLabel ?? "upcoming"}.`,
    `Start time: ${selectedTimeLabel ?? "evening"}.`,
    `Dinner: ${selectedEntree ?? "dinner"}.`,
    `Activities: ${selectedActivities.join(" and ") || "a fun evening"}.`,
  ].join("\n");
}
