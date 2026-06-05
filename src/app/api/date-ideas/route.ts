import { NextRequest, NextResponse } from "next/server";

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

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 6;
const WINDOW_MS = 60 * 60 * 1000;

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
  const limited = checkRateLimit(identifier);

  if (limited) {
    return NextResponse.json(
      { message: "Gemini idea limit reached. Try the local spinner for now." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as DateIdeasRequest;
  const prompt = buildPrompt(body);

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

  return NextResponse.json({ ideas: ideas.slice(0, 2) });
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

function checkRateLimit(identifier: string) {
  const now = Date.now();
  const current = rateLimit.get(identifier);

  if (!current || current.resetAt < now) {
    rateLimit.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  if (current.count >= LIMIT) {
    return true;
  }

  current.count += 1;
  return false;
}
