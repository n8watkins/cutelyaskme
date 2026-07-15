import { clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDbClient, db } from "@/lib/db";
import { datePlans, invites, planStops } from "@/lib/db/schema";
import {
  sendDateCanceledEmail,
  sendInviteEmail,
  sendPlanNotificationEmail,
  sendSpotReadyEmail,
} from "@/lib/email";
import {
  claimNotificationJobs,
  claimInviteNotificationJobs,
  claimPlanNotificationJobs,
  markNotificationCanceled,
  markNotificationFailed,
  markNotificationSent,
  type PlanNotificationKind,
  type ClaimedNotificationJob,
} from "@/lib/notification-outbox";
import { sendPushToSubscription } from "@/lib/push";
import type { Venue } from "@/lib/venues";
import { readPlanStops } from "@/lib/plan-stops";

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function senderDisplayName(senderId: string): Promise<string> {
  try {
    const clerk = await clerkClient();
    const sender = await clerk.users.getUser(senderId);
    return (
      sender.firstName ??
      sender.emailAddresses[0]?.emailAddress?.split("@")[0] ??
      "Someone special"
    );
  } catch {
    return "Someone special";
  }
}

export async function deliverPlanNotificationJobs(
  planId: string,
  kind: PlanNotificationKind,
): Promise<NotificationDeliverySummary> {
  const client = getDbClient();
  const jobs = await claimPlanNotificationJobs(client, planId, kind);
  return deliverClaimedNotificationJobs(jobs);
}

export async function deliverInviteNotificationJobs(
  inviteId: string,
): Promise<NotificationDeliverySummary> {
  const jobs = await claimInviteNotificationJobs(
    getDbClient(),
    inviteId,
    "invite_created",
  );
  return deliverClaimedNotificationJobs(jobs);
}

export async function deliverPendingNotificationJobs(
  limit = 20,
): Promise<NotificationDeliverySummary> {
  return deliverClaimedNotificationJobs(await claimNotificationJobs(getDbClient(), limit));
}

async function deliverClaimedNotificationJobs(
  jobs: ClaimedNotificationJob[],
): Promise<NotificationDeliverySummary> {
  if (jobs.length === 0) return { sent: 0, failed: 0, exhausted: 0, canceled: 0 };

  const client = getDbClient();
  let sent = 0;
  let failed = 0;
  let exhausted = 0;
  let canceled = 0;

  for (const job of jobs) {
    try {
      const [plan] = job.planId
        ? await db.select().from(datePlans).where(eq(datePlans.id, job.planId)).limit(1)
        : [];
      const inviteId = job.inviteId ?? plan?.inviteId;
      const [invite] = inviteId
        ? await db.select().from(invites).where(eq(invites.id, inviteId)).limit(1)
        : [];
      const senderId = invite?.senderId ?? plan?.senderId;
      const senderName = senderId ? await senderDisplayName(senderId) : "Someone special";

      if (job.kind === "invite_created") {
        if (!invite) throw new Error("invite_missing");
        await sendInviteEmail({
          recipientName: invite.recipientName,
          recipientEmail: invite.recipientEmail,
          senderName,
          token: invite.token,
          location: invite.location,
          deliveryKey: job.id,
        });
        await markNotificationSent(client, job.id);
        sent += 1;
        continue;
      }

      if (!plan) throw new Error("plan_missing");
      if (job.kind === "sender_plan_completed") {
        if (!invite) throw new Error("invite_missing");
        const clerk = await clerkClient();
        const sender = await clerk.users.getUser(plan.senderId);
        const senderEmail = sender.emailAddresses[0]?.emailAddress;
        if (!senderEmail) throw new Error("sender_email_missing");
        await sendPlanNotificationEmail({
          senderEmail,
          recipientName: invite.recipientName,
          selectedDateLabel: plan.selectedDateLabel,
          planId: plan.id,
          deliveryKey: job.id,
        });
        await markNotificationSent(client, job.id);
        sent += 1;
        continue;
      }

      if (job.kind === "plan_ready" && plan.canceledAt) {
        await markNotificationCanceled(client, job.id, "plan_canceled");
        canceled += 1;
        continue;
      }

      if (job.channel === "push") {
        if (!plan.recipientId) {
          await markNotificationCanceled(client, job.id, "recipient_unclaimed");
          canceled += 1;
          continue;
        }
        const pushResult = await sendPushToSubscription(
            job.targetId,
            plan.recipientId,
            job.kind === "date_canceled"
              ? {
                  title: "A little change of plans 💌",
                  body: "Tonight's plan was called off - more soon 💌",
                  url: `/plan/${plan.id}`,
                  tag: job.id,
                }
              : {
                  title:
                    plan.notificationMode === "share"
                      ? "Your date is set! 📍"
                      : "A surprise awaits ✨",
                  body:
                    plan.notificationMode === "share"
                      ? `${senderName} locked in the spots for your date - tap to see the plan.`
                      : `${senderName} has a date all planned for you ✨`,
                  url: `/plan/${plan.id}`,
                  tag: job.id,
                },
        );
        if (pushResult === "missing" || pushResult === "dead") {
          await markNotificationCanceled(client, job.id, `push_subscription_${pushResult}`);
          canceled += 1;
          continue;
        }
        if (pushResult === "transient_failure") {
          throw new Error("push_provider_failed");
        }
      } else {
        if (!invite) throw new Error("invite_missing");
        if (job.kind === "date_canceled") {
          await sendDateCanceledEmail({
            recipientEmail: invite.recipientEmail,
            recipientName: invite.recipientName,
            senderName,
            selectedDateLabel: plan.selectedDateLabel,
            deliveryKey: job.id,
          });
        } else {
          const normalizedStops = await db
            .select()
            .from(planStops)
            .where(eq(planStops.planId, plan.id))
            .orderBy(planStops.position);
          const stops = readPlanStops(plan, normalizedStops);
          const venues =
            plan.notificationMode === "share"
              ? stops.flatMap((stop) => {
                  const venue = safeParse<Venue | null>(stop.venue, null);
                  return venue
                    ? [{
                        name: venue.name,
                        address: venue.address,
                        lat: venue.lat,
                        lng: venue.lng,
                      }]
                    : [];
                })
              : [];
          await sendSpotReadyEmail({
            mode: plan.notificationMode === "share" ? "share" : "surprise",
            recipientEmail: invite.recipientEmail,
            recipientName: invite.recipientName,
            senderName,
            selectedDateLabel: plan.selectedDateLabel,
            selectedTimeLabel: plan.selectedTimeLabel,
            planId: plan.id,
            inviteToken: plan.recipientId ? undefined : invite.token,
            venues,
            deliveryKey: job.id,
          });
        }
      }

      await markNotificationSent(client, job.id);
      sent += 1;
    } catch (error) {
      const errorCode =
        error instanceof Error && /^[a-z0-9_-]{1,64}$/i.test(error.message)
          ? error.message
          : "delivery_failed";
      const status = await markNotificationFailed(
        client,
        job.id,
        errorCode,
        Math.min(60, 2 ** Math.min(job.attempts, 5)),
        job.attempts,
      );
      if (status === "exhausted") exhausted += 1;
      else failed += 1;
    }
  }

  return { sent, failed, exhausted, canceled };
}

export type NotificationDeliverySummary = {
  sent: number;
  failed: number;
  exhausted: number;
  canceled: number;
};
