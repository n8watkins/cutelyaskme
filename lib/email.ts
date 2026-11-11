import { emailAppUrl, emailSubject, emailText, emailUrl } from "@/lib/email-security";
import { numberedStopMarkers, signedStaticMapUrl } from "@/lib/static-map";
import { trackApiUsage } from "@/lib/api-usage";
import { deliverEmail } from "@/lib/email-delivery";

// Email clients send no referrer, so only a SIGNED static map URL loads there
// (the browser key's referrer restrictions reject referrer-less requests).
// signedStaticMapUrl returns null when STATIC_MAPS_SIGNING_SECRET or the maps
// key is missing - the email then simply ships without the picture.
function staticMapImgHtml(url: string | null, alt: string): string {
  if (!url) return "";
  void trackApiUsage("static-maps");
  return `<img src="${emailUrl(url)}" alt="${emailText(alt)}" width="600" style="display:block;width:100%;max-width:480px;height:auto;border-radius:16px;margin:16px 0;border:2px solid #ffd6e8;" />`;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function authenticatedPlanUrl(planId: string): string {
  const loginUrl = new URL(emailAppUrl(SITE_URL, "login"));
  loginUrl.searchParams.set("returnTo", `/plan/${planId}`);
  return loginUrl.toString();
}

export async function sendPlanNotificationEmail({
  senderEmail,
  recipientName,
  selectedDateLabel,
  planId,
  deliveryKey,
}: {
  senderEmail: string;
  recipientName: string;
  selectedDateLabel: string | null;
  planId: string;
  deliveryKey?: string;
}) {
  const link = authenticatedPlanUrl(planId);
  const safeLink = emailUrl(link);
  const safeRecipientName = emailText(recipientName);
  const safeDateLabel = selectedDateLabel ? emailText(selectedDateLabel) : null;

  await deliverEmail("plan-locked", {
    to: senderEmail,
    subject: emailSubject(`${recipientName} locked in the plan! 🎉`),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #fff7fb; padding: 32px; border-radius: 24px;">
        <h1 style="color: #3a2530; font-size: 24px; margin-bottom: 8px;">It's a date! 🎉</h1>
        <p style="color: #8a6a78; font-size: 16px; line-height: 1.6;">
          <strong>${safeRecipientName}</strong> just locked in the plan${safeDateLabel ? ` for <strong>${safeDateLabel}</strong>` : ""}.
          Your itinerary is ready.
        </p>
        <a href="${safeLink}" style="display: inline-block; margin: 24px 0; padding: 14px 28px; background: #ff7aaa; color: white; text-decoration: none; border-radius: 999px; font-weight: bold; font-size: 16px;">
          See the plan ✨
        </a>
        <p style="color: #c0a0b0; font-size: 13px;">
          Or paste this link: ${safeLink}
        </p>
      </div>
    `,
    deliveryKey,
  });
}

export async function sendSpotReadyEmail({
  mode,
  recipientEmail,
  recipientName,
  senderName,
  selectedDateLabel,
  selectedTimeLabel,
  planId,
  inviteToken,
  venues,
  deliveryKey,
}: {
  mode: "share" | "surprise";
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  selectedDateLabel: string | null;
  selectedTimeLabel: string | null;
  planId: string;
  inviteToken?: string;
  venues: { name: string; address: string; lat?: number; lng?: number }[];
  deliveryKey?: string;
}) {
  let rawPlanLink;
  if (inviteToken) {
    rawPlanLink = `${emailAppUrl(SITE_URL, "api", "invites", "redeem")}?token=${encodeURIComponent(inviteToken)}`;
  } else {
    rawPlanLink = authenticatedPlanUrl(planId);
  }
  const planLink = emailUrl(rawPlanLink);
  const when = emailText(
    [selectedDateLabel, selectedTimeLabel].filter(Boolean).join(" at "),
  );
  const safeRecipientName = emailText(recipientName);
  const safeSenderName = emailText(senderName);

  // Share mode gets a snapshot of the spots (numbered to match the list
  // order); surprise mode stays a surprise. Empty string when unsigned.
  const stopPoints = venues
    .filter((v) => typeof v.lat === "number" && typeof v.lng === "number")
    .map((v) => ({ lat: v.lat as number, lng: v.lng as number }));
  const mapHtml =
    mode === "share" && stopPoints.length > 0
      ? staticMapImgHtml(
          signedStaticMapUrl({ markers: numberedStopMarkers(stopPoints), path: stopPoints }),
          "Map of your date spots",
        )
      : "";

  const subject =
    mode === "share"
      ? emailSubject(`${senderName} just locked in the spots! 📍`)
      : `The plan is set - see you soon ✨`;

  const venueListHtml =
    mode === "share" && venues.length
      ? `<ul style="padding:0;margin:16px 0;list-style:none;">
          ${venues
            .map(
              (v) =>
                `<li style="margin-bottom:10px;padding:12px;background:#fff7fb;border-radius:12px;">
                  <strong style="color:#3a2530">${emailText(v.name)}</strong><br>
                  <span style="color:#8a6a78;font-size:13px">${emailText(v.address)}</span>
                </li>`,
            )
            .join("")}
        </ul>`
      : "";

  const body =
    mode === "share"
      ? `<p style="color:#8a6a78;font-size:16px;line-height:1.6;">
          <strong>${safeSenderName}</strong> just picked the spots for your date${when ? ` on <strong>${when}</strong>` : ""}. Here's where you're going:
        </p>
        ${venueListHtml}
        ${mapHtml}
        <a href="${planLink}" style="display:inline-block;margin:20px 0;padding:14px 28px;background:#ff7aaa;color:white;text-decoration:none;border-radius:999px;font-weight:bold;font-size:15px;">
          See the full plan ✨
        </a>`
      : `<p style="color:#8a6a78;font-size:16px;line-height:1.6;">
          <strong>${safeSenderName}</strong> has everything planned${when ? ` for <strong>${when}</strong>` : ""}.
          Just show up ready — the rest is a surprise. 🎁
        </p>
        <p style="color:#c0a0b0;font-size:14px;margin-top:16px;">
          All the details will be waiting for you when it's time.
        </p>
        <a href="${planLink}" style="display:inline-block;margin:20px 0;padding:14px 28px;background:#ff7aaa;color:white;text-decoration:none;border-radius:999px;font-weight:bold;font-size:15px;">
          Open your date 🎁
        </a>`;

  await deliverEmail("spot-ready", {
    to: recipientEmail,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#fff7fb;padding:32px;border-radius:24px;">
        <h1 style="color:#3a2530;font-size:24px;margin-bottom:8px;">Hey ${safeRecipientName}! 💌</h1>
        ${body}
        <p style="color:#c0a0b0;font-size:12px;margin-top:24px;">Planned with Cutely Ask Me 🌸</p>
      </div>
    `,
    deliveryKey,
  });
}

// F4: gentle heads-up when a shared date gets called off. No guilt, no details.
export async function sendDateCanceledEmail({
  recipientEmail,
  recipientName,
  senderName,
  selectedDateLabel,
  deliveryKey,
}: {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  selectedDateLabel: string | null;
  deliveryKey?: string;
}) {
  const safeRecipientName = emailText(recipientName);
  const safeSenderName = emailText(senderName);
  const safeDateLabel = selectedDateLabel ? emailText(selectedDateLabel) : null;
  await deliverEmail("date-canceled", {
    to: recipientEmail,
    subject: `A little change of plans 💌`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#fff7fb;padding:32px;border-radius:24px;">
        <h1 style="color:#3a2530;font-size:24px;margin-bottom:8px;">Hey ${safeRecipientName} 💌</h1>
        <p style="color:#8a6a78;font-size:16px;line-height:1.6;">
          ${safeDateLabel ? `The plan for <strong>${safeDateLabel}</strong>` : "The plan"} was called off - more soon 💌
        </p>
        <p style="color:#c0a0b0;font-size:14px;margin-top:16px;">
          ${safeSenderName} will make it up to you. Promise.
        </p>
        <p style="color:#c0a0b0;font-size:12px;margin-top:24px;">Planned with Cutely Ask Me 🌸</p>
      </div>
    `,
    deliveryKey,
  });
}

export async function sendInviteEmail({
  recipientName,
  recipientEmail,
  senderName,
  token,
  location,
  deliveryKey,
}: {
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  token: string;
  /** Free-text date city ("Austin, TX") - teased as a soft map when present. */
  location?: string | null;
  deliveryKey?: string;
}) {
  const link = emailUrl(emailAppUrl(SITE_URL, "invite", token));
  const safeRecipientName = emailText(recipientName);
  const safeSenderName = emailText(senderName);

  // No venues exist yet at invite time, so the teaser is just the city -
  // Static Maps geocodes the address string itself, no markers needed.
  const mapHtml = location
    ? staticMapImgHtml(
        signedStaticMapUrl({ center: location, zoom: 12, style: "soft" }),
        `A map of ${location}`,
      )
    : "";

  await deliverEmail("invite", {
    to: recipientEmail,
    subject: emailSubject(`${senderName} wants to plan a date with you 💌`),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #fff7fb; padding: 32px; border-radius: 24px;">
        <h1 style="color: #3a2530; font-size: 24px; margin-bottom: 8px;">Hey ${safeRecipientName}! 💌</h1>
        <p style="color: #8a6a78; font-size: 16px; line-height: 1.6;">
          <strong>${safeSenderName}</strong> wants to plan a date night with you.
          Click below to see the invite and pick what sounds good.
        </p>
        ${mapHtml}
        <a href="${link}" style="display: inline-block; margin: 24px 0; padding: 14px 28px; background: #ff7aaa; color: white; text-decoration: none; border-radius: 999px; font-weight: bold; font-size: 16px;">
          Open my invite ✨
        </a>
        <p style="color: #c0a0b0; font-size: 13px;">
          Or paste this link: ${link}
        </p>
      </div>
    `,
    deliveryKey,
  });
}
