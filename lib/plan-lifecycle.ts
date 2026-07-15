import { eq } from "drizzle-orm";
import { isDateOver, type DateEndPlanRow } from "./date-end";
import { db } from "./db";
import { planStops } from "./db/schema";

export async function isStoredPlanDateOver(
  plan: DateEndPlanRow & { id: string },
  now: Date = new Date(),
): Promise<boolean> {
  const stops = await db
    .select({
      position: planStops.position,
      durationMinutes: planStops.durationMinutes,
      travelMinutes: planStops.travelMinutes,
    })
    .from(planStops)
    .where(eq(planStops.planId, plan.id))
    .orderBy(planStops.position);
  return isDateOver(plan, now, stops);
}
