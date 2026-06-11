// F3: which plan should the dashboard's "How did your date go?" modal ask
// about? — pure helpers, tested in review-prompt.test.ts.
//
// A plan is eligible when it was confirmed (shared), wasn't called off, its
// dateEnd has passed, and the user hasn't reviewed it yet (no rating AND no
// venue verdicts — callers pass those plan ids in). We prompt about at most
// one plan per visit: the most recently-ended eligible one.

import { dateEndFromPlan, isDateOver, type DateEndPlanRow } from "./date-end";

export type ReviewCandidatePlan = DateEndPlanRow & {
  id: string;
  confirmedAt: string | null;
  canceledAt: string | null;
};

/**
 * The single plan to prompt the user about, or null. `reviewedPlanIds` are
 * plans the user already rated or swiped verdicts for (server-side check —
 * the half of "never re-prompt" that works across devices; the other half is
 * the client's `ca:reviewPrompted:<planId>` localStorage flag).
 */
export function pickReviewPromptPlan<T extends ReviewCandidatePlan>(
  plans: T[],
  reviewedPlanIds: ReadonlySet<string>,
  now: Date = new Date(),
): T | null {
  const eligible = plans.filter(
    (p) =>
      p.confirmedAt !== null &&
      p.canceledAt === null &&
      !reviewedPlanIds.has(p.id) &&
      isDateOver(p, now),
  );
  if (eligible.length === 0) return null;

  // Most recently ended first — isDateOver(true) guarantees dateEnd ≠ null.
  return eligible.reduce((best, p) =>
    dateEndFromPlan(p)!.getTime() > dateEndFromPlan(best)!.getTime() ? p : best,
  );
}

/** "2026-06-09" → "Tuesday" (local calendar day), or null when unparseable. */
export function weekdayName(selectedDate: string | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(selectedDate ?? "");
  if (!m) return null;
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

/** The modal headline: "How did Tuesday's date go? 💘" (or a dayless fallback). */
export function reviewPromptTitle(selectedDate: string | null): string {
  const day = weekdayName(selectedDate);
  return day ? `How did ${day}'s date go? 💘` : "How did your date go? 💘";
}
