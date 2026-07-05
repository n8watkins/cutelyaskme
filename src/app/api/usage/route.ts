import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { datePlans } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { getUsageSummary, getUsageByPlan, trackApiUsage } from "@/lib/api-usage";
import {
  API_LIMITS,
  TRACKED_SERVICES,
  CLIENT_TRACKED_SERVICES,
  sanitizePlanId,
} from "@/lib/api-limits";

export type UsageEntry = {
  service: string;
  label: string;
  shortLabel: string;
  monthlyCap: number | null;
  dailyBudget: number | null;
  today: number;
  monthToDate: number;
};

export type PlanUsage = {
  planId: string;
  /** The plan's date label when the caller owns the plan, else a short id. */
  label: string;
  services: Record<string, number>;
  total: number;
};

/**
 * C7: outbound API usage for the planner and the Settings dashboard —
 * per-service today + month-to-date counts with cap metadata, plus a
 * month-to-date per-plan breakdown.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const [summary, planRows] = await Promise.all([
    getUsageSummary(TRACKED_SERVICES),
    getUsageByPlan(),
  ]);

  const usage: UsageEntry[] = API_LIMITS.map((l) => ({
    service: l.service,
    label: l.label,
    shortLabel: l.shortLabel,
    monthlyCap: l.monthlyCap,
    dailyBudget: l.dailyBudget,
    today: summary[l.service]?.today ?? 0,
    monthToDate: summary[l.service]?.monthToDate ?? 0,
  }));

  const byPlan = new Map<string, PlanUsage>();
  for (const row of planRows) {
    const entry = byPlan.get(row.planId) ?? {
      planId: row.planId,
      label: `Plan ${row.planId.slice(0, 8)}`,
      services: {},
      total: 0,
    };
    entry.services[row.service] = (entry.services[row.service] ?? 0) + row.count;
    entry.total += row.count;
    byPlan.set(row.planId, entry);
  }

  // Label the caller's own plans with their date; other plans keep the short id.
  if (byPlan.size > 0) {
    try {
      const rows = await db
        .select({
          id: datePlans.id,
          senderId: datePlans.senderId,
          dateLabel: datePlans.selectedDateLabel,
          date: datePlans.selectedDate,
        })
        .from(datePlans)
        .where(inArray(datePlans.id, [...byPlan.keys()]));
      for (const r of rows) {
        const entry = byPlan.get(r.id);
        if (entry && r.senderId === userId) {
          entry.label = r.dateLabel ?? r.date ?? entry.label;
        }
      }
    } catch {}
  }

  const plans = [...byPlan.values()].sort((a, b) => b.total - a.total);
  return NextResponse.json({ usage, plans });
}

/**
 * Client-side usage beacons (DateMap counts one maps-js-loads per map init).
 * Only whitelisted services are accepted so a stray client can't skew the
 * server-counted meters.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { service?: string; planId?: string }
    | null;
  const service = body?.service;
  if (!service || !CLIENT_TRACKED_SERVICES.has(service)) {
    return NextResponse.json({ message: "Unknown service" }, { status: 400 });
  }

  await trackApiUsage(service, 1, sanitizePlanId(body?.planId));
  return new NextResponse(null, { status: 204 });
}
