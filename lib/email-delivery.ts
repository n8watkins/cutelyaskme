import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Client } from "@libsql/client";
import { getDbClient } from "@/lib/db";
import { getApiLimit } from "@/lib/api-limits";
import { trackApiUsage } from "@/lib/api-usage";
import { logError } from "@/lib/log";
import { budgetKey, reserveServiceBudget } from "@/lib/service-budget";

// Every email goes out through Cloudflare Email Service (the Worker's `EMAIL`
// send_email binding, no API key). This module is the one place that sends:
//  - a daily cap (the "email" entry in lib/api-limits.ts) so a bug or abuse
//    cannot run the account's monthly allowance away;
//  - a delivery ledger keyed by the outbox job id, so a retried job whose first
//    send actually went out is not sent twice (this replaces Resend's
//    idempotency key);
//  - one log line per send: the kind, never an address.

export const EMAIL_FROM = { email: "cutelyaskme@n8builds.dev", name: "Cutely Ask Me" };

export type EmailKind = "invite" | "plan-locked" | "spot-ready" | "date-canceled";

export type EmailBinding = {
  send(message: {
    to: string;
    from: { email: string; name: string };
    subject: string;
    html: string;
    text: string;
  }): Promise<unknown>;
};

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  /** Outbox job id: the same key is sent at most once. */
  deliveryKey?: string;
};

export type EmailDeps = {
  binding: EmailBinding | undefined;
  client: Client;
  now: () => number;
  track: (service: "email") => Promise<void>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
// A delivery key is remembered for 30 days; outbox retries all happen within hours.
const LEDGER_MS = 30 * DAY_MS;
const LEDGER_SERVICE = "email-delivered";

function defaultDeps(): EmailDeps {
  let binding: EmailBinding | undefined;
  try {
    binding = (getCloudflareContext().env as { EMAIL?: EmailBinding }).EMAIL;
  } catch {
    binding = undefined; // not on the Worker (next dev, unit tests)
  }
  return { binding, client: getDbClient(), now: Date.now, track: (s) => trackApiUsage(s) };
}

function plainText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<\/(p|div|h1|li)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function alreadyDelivered(client: Client, deliveryKey: string): Promise<boolean> {
  const result = await client.execute({
    sql: "SELECT 1 FROM service_budgets WHERE key = ?",
    args: [budgetKey(LEDGER_SERVICE, `delivery:${deliveryKey}`, 1)],
  });
  return result.rows.length > 0;
}

async function recordDelivered(client: Client, deliveryKey: string, now: number): Promise<void> {
  await reserveServiceBudget(client, {
    service: LEDGER_SERVICE,
    windowStart: 1,
    windowEnd: now + LEDGER_MS,
    limits: [{ subjectId: `delivery:${deliveryKey}`, limit: 1 }],
  });
}

/**
 * Send one email. Throws a short machine code the outbox stores as the failure
 * reason (`email_not_configured`, `email_daily_cap`); a send the provider
 * refuses throws its own error and the job retries.
 */
export async function deliverEmail(
  kind: EmailKind,
  email: OutgoingEmail,
  deps: EmailDeps = defaultDeps(),
): Promise<void> {
  const { binding, client } = deps;
  if (!binding) throw new Error("email_not_configured");

  if (email.deliveryKey && (await alreadyDelivered(client, email.deliveryKey))) {
    console.log(JSON.stringify({ event: "email_duplicate_skipped", kind }));
    return;
  }

  const dailyBudget = getApiLimit("email")?.dailyBudget;
  if (dailyBudget) {
    const windowStart = Math.floor(deps.now() / DAY_MS) * DAY_MS;
    const reservation = await reserveServiceBudget(client, {
      service: "email",
      windowStart,
      windowEnd: windowStart + DAY_MS,
      limits: [{ subjectId: "global", limit: dailyBudget }],
    });
    if (!reservation.allowed) {
      logError({ event: "email_daily_cap_reached", reason: "email_daily_cap", route: "email", kind });
      throw new Error("email_daily_cap");
    }
  }

  await binding.send({
    to: email.to,
    from: EMAIL_FROM,
    subject: email.subject,
    html: email.html,
    text: plainText(email.html),
  });

  // Past this point the email is out: bookkeeping must never fail the job,
  // or the retry would send it again.
  console.log(JSON.stringify({ event: "email_sent", kind }));
  await Promise.allSettled([
    email.deliveryKey ? recordDelivered(client, email.deliveryKey, deps.now()) : undefined,
    deps.track("email"),
  ]);
}
