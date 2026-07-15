import { auth } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { datePlans, invites } from "@/lib/db/schema";
import { requireRouteSender } from "@/lib/plan-route-access";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const [plan] = await db.select().from(datePlans).where(eq(datePlans.id, id)).limit(1);
  if (!plan || !plan.inviteId) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }
  try {
    requireRouteSender(plan, userId);
  } catch {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }

  await db
    .update(invites)
    .set({
      capabilityVersion: sql`${invites.capabilityVersion} + 1`,
      token: crypto.randomUUID(),
    })
    .where(eq(invites.id, plan.inviteId));
  return NextResponse.json({ ok: true });
}
