import { auth } from "@clerk/nextjs/server";
import { db, getDbClient } from "@/lib/db";
import { datePlans, invites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { deliverPlanNotificationJobs } from "@/lib/notification-delivery";
import { enqueuePlanNotifications } from "@/lib/notification-outbox";
import {
  NOTIFICATION_QUEUE_INITIAL_DELAY_SECONDS,
  scheduleNotificationDelivery,
} from "@/lib/notification-queue";
import { requireRouteSender } from "@/lib/plan-route-access";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const mode: "share" | "surprise" = body?.mode === "share" ? "share" : "surprise";

  const [plan] = await db
    .select()
    .from(datePlans)
    .where(eq(datePlans.id, id))
    .limit(1);

  if (!plan) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }
  try {
    requireRouteSender(plan, userId);
  } catch {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }

  // F4: never share or notify a canceled plan.
  if (plan.canceledAt) {
    return NextResponse.json({ message: "This date was canceled" }, { status: 409 });
  }

  if (!plan.inviteId) {
    return NextResponse.json({ message: "No invite linked to this plan" }, { status: 400 });
  }

  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.id, plan.inviteId))
    .limit(1);

  if (!invite) {
    return NextResponse.json({ message: "Invite not found" }, { status: 404 });
  }

  const client = getDbClient();
  const transaction = await client.transaction("write");
  try {
    const updated = await transaction.execute({
      sql: `
        UPDATE date_plans
        SET
          confirmed_at = COALESCE(confirmed_at, ?),
          notification_mode = COALESCE(notification_mode, ?)
        WHERE id = ? AND sender_id = ? AND canceled_at IS NULL
      `,
      args: [new Date().toISOString(), mode, id, userId],
    });
    if (updated.rowsAffected !== 1) {
      await transaction.rollback();
      return NextResponse.json({ message: "This date was canceled" }, { status: 409 });
    }
    await enqueuePlanNotifications(transaction, id, "plan_ready");
    await transaction.commit();
  } finally {
    transaction.close();
  }

  await scheduleNotificationDelivery({
    idempotencyKey: `plan-ready:${id}`,
    reason: "new",
    delaySeconds: NOTIFICATION_QUEUE_INITIAL_DELAY_SECONDS,
  });
  const delivery = await deliverPlanNotificationJobs(id, "plan_ready");
  return NextResponse.json({ ok: true, delivery });
}
