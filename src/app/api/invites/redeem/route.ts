import { db } from "@/lib/db";
import { datePlans, invites } from "@/lib/db/schema";
import { mintPlanCapability } from "@/lib/plan-capability";
import { planCapabilityCookieName } from "@/lib/plan-route-access";
import { resolveZonedDateTime } from "@/lib/plan-time";
import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

const MINIMUM_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) return NextResponse.redirect(new URL("/", request.url));

  const [record] = await db
    .select({
      plan: datePlans,
      capabilityVersion: invites.capabilityVersion,
    })
    .from(invites)
    .innerJoin(datePlans, eq(datePlans.inviteId, invites.id))
    .where(
      and(
        eq(invites.token, token),
        eq(invites.status, "completed"),
        isNull(datePlans.recipientId),
      ),
    )
    .limit(1);
  if (!record) return NextResponse.redirect(new URL("/login", request.url));

  const secret = process.env.PLAN_CAPABILITY_SECRET;
  if (!secret) return NextResponse.redirect(new URL("/", request.url));
  const start =
    record.plan.selectedDate && record.plan.selectedTime
      ? resolveZonedDateTime(
          record.plan.selectedDate,
          record.plan.selectedTime,
          record.plan.timezone,
        )
      : null;
  const expiresAt = Math.max(
    Date.now() + MINIMUM_TTL_MS,
    start?.ok ? start.instant.getTime() + 30 * 24 * 60 * 60 * 1000 : 0,
  );
  const capability = mintPlanCapability(
    {
      planId: record.plan.id,
      inviteId: record.plan.inviteId!,
      capabilityVersion: record.capabilityVersion,
      expiresAt,
    },
    secret,
  );
  const response = NextResponse.redirect(new URL(`/plan/${record.plan.id}`, request.url));
  response.cookies.set(planCapabilityCookieName(record.plan.id), capability, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor((expiresAt - Date.now()) / 1000),
    expires: new Date(expiresAt),
  });
  return response;
}
