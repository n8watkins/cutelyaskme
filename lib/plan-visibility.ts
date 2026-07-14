import { resolveZonedDateTime } from "./plan-time";

export type PlanVisibilityRecord = {
  notificationMode: "share" | "surprise" | null;
  confirmedAt: string | null;
  revealedAt: string | null;
  selectedDate: string | null;
  selectedTime: string | null;
  timezone: string;
};

/** Surprise details become visible at the explicit reveal or plan start. */
export function areRecipientPlanDetailsVisible(
  plan: PlanVisibilityRecord,
  now: Date = new Date(),
): boolean {
  if (!plan.confirmedAt) return false;
  if (plan.notificationMode !== "surprise") return true;

  const revealedAt = plan.revealedAt ? new Date(plan.revealedAt) : null;
  if (revealedAt && !Number.isNaN(revealedAt.getTime()) && revealedAt <= now) {
    return true;
  }
  if (!plan.selectedDate || !plan.selectedTime) return false;

  const start = resolveZonedDateTime(
    plan.selectedDate,
    plan.selectedTime,
    plan.timezone,
  );
  return start.ok && start.instant <= now;
}
