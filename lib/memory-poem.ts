type PoemInput = {
  notes: string;
  recipientName?: string | null;
  selectedDateLabel?: string | null;
  selectedEntree?: string | null;
  activities?: string[];
};

// Generates a short keepsake poem about the date from the author's notes.
// Returns null when GEMINI_API_KEY is unset or the call fails.
export async function generateMemoryPoem(input: PoemInput): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const prompt = buildPoemPrompt(input);

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
            temperature: 0.9,
            maxOutputTokens: 400,
            // 2.5 Flash is a thinking model; disable it so the budget is all poem.
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

  return text.trim() || null;
}

function buildPoemPrompt({
  notes,
  recipientName,
  selectedDateLabel,
  selectedEntree,
  activities,
}: PoemInput) {
  const context: string[] = [];
  if (selectedDateLabel) context.push(`Date: ${selectedDateLabel}.`);
  if (recipientName && recipientName !== "her") context.push(`With: ${recipientName}.`);
  if (selectedEntree) context.push(`Dinner: ${selectedEntree}.`);
  if (activities?.length) context.push(`Activities: ${activities.join(", ")}.`);

  return [
    "Write a short, warm keepsake poem about a date night — 8 to 16 lines.",
    "Tone: tender, playful, personal, a little romantic. Not cheesy or generic.",
    "Weave in the real details and feelings from the notes below when it feels natural.",
    "Output the poem ONLY — no title, no preamble, no explanation.",
    context.length ? `\nContext:\n${context.join("\n")}` : "",
    `\nTheir notes from the date:\n${notes}`,
  ]
    .filter(Boolean)
    .join("\n");
}
