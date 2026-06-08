import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

type DateIdeasRequest = {
  period?: string;
  selectedTime?: string | null;
  selectedDateLabel?: string | null;
  selectedEntree?: string | null;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

const LIMIT = 6;
const WINDOW_MS = 60 * 60 * 1000;

// In-memory suggestion cache keyed by (period:time:date:entree).
// Lives as long as the serverless instance stays warm — typically minutes to hours.
// Identical inputs always get the same response without a Gemini call.
const suggestionCache = new Map<string, { ideas: string[]; expiresAt: number }>();
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export async function POST(request: NextRequest) {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    return NextResponse.json(
      {
        message:
          "Gemini is not configured yet. Add GEMINI_API_KEY to enable fresh ideas.",
      },
      { status: 503 },
    );
  }

  const identifier = getClientIdentifier(request);
  const allowed = await checkRateLimit(`ideas:${identifier}`, LIMIT, WINDOW_MS);

  if (!allowed) {
    return NextResponse.json(
      { message: "Gemini idea limit reached. Try the local spinner for now." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as DateIdeasRequest;

  // Check cache before consuming a Gemini call or a rate-limit slot
  const cacheKey = `${body.period ?? "evening"}:${body.selectedTime ?? ""}:${body.selectedDateLabel ?? ""}:${body.selectedEntree ?? ""}`;
  const cached = suggestionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ ideas: cached.ideas, fromCache: true });
  }

  const prompt = buildPrompt(body);

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
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 160,
            responseMimeType: "application/json",
            // 3.1 Flash Lite thinking would consume the whole 160-token budget before
            // producing any ideas; disable it for this simple structured task.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );
  } catch {
    return NextResponse.json(
      { message: "Gemini could not make ideas right now." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { message: "Gemini could not make ideas right now." },
      { status: 502 },
    );
  }

  const payload = (await response.json()) as GeminiResponse;
  const text =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("\n") ?? "";
  const ideas = parseIdeas(text);

  if (ideas.length < 2) {
    return NextResponse.json(
      { message: "Gemini returned ideas in a weird shape. Try again." },
      { status: 502 },
    );
  }

  const finalIdeas = ideas.slice(0, 2);
  suggestionCache.set(cacheKey, { ideas: finalIdeas, expiresAt: Date.now() + CACHE_TTL_MS });
  return NextResponse.json({ ideas: finalIdeas, fromCache: false });
}

function buildPrompt({
  period,
  selectedTime,
  selectedDateLabel,
  selectedEntree,
}: DateIdeasRequest) {
  return [
    "Return JSON only in this exact shape: {\"ideas\":[\"emoji short idea\",\"emoji short idea\"]}.",
    "Create exactly two cute date-night activity ideas.",
    "Each idea must start with one emoji and be 2 to 5 words after the emoji.",
    "Do not include restaurants, dinner, or dessert because dinner is already selected.",
    "Keep it sweet, low-pressure, and on-brand for a pastel date invite.",
    "Avoid unsafe, expensive, or logistically intense ideas.",
    `Time period: ${period ?? "evening"}.`,
    `Selected time: ${selectedTime ?? "not set"}.`,
    `Selected date: ${selectedDateLabel ?? "not set"}.`,
    `Dinner anchor: ${selectedEntree ?? "not set"}.`,
  ].join("\n");
}

function parseIdeas(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as { ideas?: unknown };

    if (!Array.isArray(parsed.ideas)) {
      return [];
    }

    return parsed.ideas
      .filter((idea): idea is string => typeof idea === "string")
      .map((idea) => idea.trim())
      .filter(Boolean)
      .slice(0, 2);
  } catch {
    return cleaned
      .split("\n")
      .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 2);
  }
}

function getClientIdentifier(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local"
  );
}

