import { auth } from "@clerk/nextjs/server";
import { db, getDbClient } from "@/lib/db";
import { datePlans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { deliverPlanNotificationJobs } from "@/lib/notification-delivery";
import { enqueuePlanNotifications } from "@/lib/notification-outbox";
import {
  NOTIFICATION_QUEUE_INITIAL_DELAY_SECONDS,
  scheduleNotificationDelivery,
} from "@/lib/notification-queue";
import { requireRouteSender } from "@/lib/plan-route-access";

// F4: the sender calls the date off. Freezes the plan (canceledAt) and, if it
// was already shared with the recipient, gently lets them know (best-effort:
// notification failures never fail the cancel).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

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

  // Already canceled means there is nothing to do (idempotent, no duplicate notifications).
  if (plan.canceledAt) {
    return NextResponse.json({ ok: true, alreadyCanceled: true });
  }

  const client = getDbClient();
  const transaction = await client.transaction("write");
  let wasShared = false;
  let alreadyCanceled = false;
  try {
    const canceled = await transaction.execute({
      sql: `
        UPDATE date_plans
        SET canceled_at = ?
        WHERE id = ? AND sender_id = ? AND canceled_at IS NULL
        RETURNING confirmed_at
      `,
      args: [new Date().toISOString(), id, userId],
    });
    if (canceled.rows.length === 0) {
      alreadyCanceled = true;
      await transaction.rollback();
    } else {
      wasShared = canceled.rows[0]?.confirmed_at !== null;
      if (wasShared) {
        await enqueuePlanNotifications(transaction, id, "date_canceled");
      }
      await transaction.commit();
    }
  } finally {
    transaction.close();
  }

  if (alreadyCanceled) {
    return NextResponse.json({ ok: true, alreadyCanceled: true });
  }

  if (wasShared) {
    await scheduleNotificationDelivery({
      idempotencyKey: `date-canceled:${id}`,
      reason: "new",
      delaySeconds: NOTIFICATION_QUEUE_INITIAL_DELAY_SECONDS,
    });
  }
  const delivery = wasShared
    ? await deliverPlanNotificationJobs(id, "date_canceled").catch((error) => {
        console.error("Failed to deliver cancellation notifications", error);
        return { sent: 0, failed: 0, exhausted: 0, canceled: 0 };
      })
    : { sent: 0, failed: 0, exhausted: 0, canceled: 0 };
  return NextResponse.json({ ok: true, delivery });
}
