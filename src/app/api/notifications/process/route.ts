import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { deliverPendingNotificationJobs } from "@/lib/notification-delivery";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function authorized(request: NextRequest, secrets: string[]): boolean {
  const match = /^Bearer ([^\s]+)$/.exec(request.headers.get("authorization") ?? "");
  if (!match) return false;

  const suppliedDigest = digest(match[1]);
  return secrets.some((secret) => timingSafeEqual(suppliedDigest, digest(secret)));
}

export async function GET(request: NextRequest) {
  const secrets = [process.env.CRON_SECRET, process.env.NOTIFICATION_WORKER_SECRET].filter(
    (secret): secret is string => typeof secret === "string" && secret.length > 0,
  );
  if (secrets.length === 0) {
    return NextResponse.json({ message: "Worker is not configured" }, { status: 503 });
  }
  if (!authorized(request, secrets)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { sent, failed, exhausted, canceled } = await deliverPendingNotificationJobs(20);

  return NextResponse.json({
    processed: sent + failed + exhausted + canceled,
    sent,
    failed,
    exhausted,
    canceled,
  });
}
