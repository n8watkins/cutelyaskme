import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { deliverPendingNotificationJobs } from "@/lib/notification-delivery";

const RECONCILIATION_BATCH_SIZE = 20;
const MAX_RECONCILIATION_BATCHES = 5;

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

  let sent = 0;
  let failed = 0;
  let exhausted = 0;
  let canceled = 0;

  for (let batch = 0; batch < MAX_RECONCILIATION_BATCHES; batch += 1) {
    const summary = await deliverPendingNotificationJobs(RECONCILIATION_BATCH_SIZE);
    sent += summary.sent;
    failed += summary.failed;
    exhausted += summary.exhausted;
    canceled += summary.canceled;

    const processed =
      summary.sent + summary.failed + summary.exhausted + summary.canceled;
    if (processed < RECONCILIATION_BATCH_SIZE) break;
  }

  return NextResponse.json({
    processed: sent + failed + exhausted + canceled,
    sent,
    failed,
    exhausted,
    canceled,
  });
}
