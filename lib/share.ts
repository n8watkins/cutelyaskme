export type SharePlanInput = {
  recipientName: string;
  selectedDateLabel: string;
  selectedTimeLabel: string;
  selectedEntree: string;
  selectedActivities: string[];
};

export function getPlanText({
  selectedDateLabel,
  selectedTimeLabel,
  selectedEntree,
  selectedActivities,
}: SharePlanInput) {
  return [
    "It's a date!",
    "",
    `Date: ${selectedDateLabel}`,
    `Time: ${selectedTimeLabel}`,
    `Plan: ${selectedActivities.join(" + ")}`,
    `Dinner: ${selectedEntree}`,
    "",
    "See you then :)",
  ].join("\n");
}

export async function sharePlan(input: SharePlanInput) {
  const text = getPlanText(input);
  const url = typeof window !== "undefined" ? window.location.href : "";

  if (typeof navigator !== "undefined" && navigator.share) {
    await navigator.share({
      title: "Our Date Night Plan",
      text: `It's a date! ${input.recipientName} picked ${input.selectedDateLabel} at ${input.selectedTimeLabel}. Plan: ${input.selectedActivities.join(" + ")}. Food: ${input.selectedEntree}.`,
      url,
    });

    return "shared" as const;
  }

  await navigator.clipboard.writeText(text);
  return "copied" as const;
}
