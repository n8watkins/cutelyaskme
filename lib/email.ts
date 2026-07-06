import { Resend } from "resend";
import { htmlEscape } from "@/lib/html";
import { numberedStopMarkers, signedStaticMapUrl } from "@/lib/static-map";
import { trackApiUsage } from "@/lib/api-usage";

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
  return new Resend(process.env.RESEND_API_KEY);
}

// Email clients send no referrer, so only a SIGNED static map URL loads there
// (the browser key's referrer restrictions reject referrer-less requests).
// signedStaticMapUrl returns null when STATIC_MAPS_SIGNING_SECRET or the maps
// key is missing - the email then simply ships without the picture.
function staticMapImgHtml(url: string | null, alt: string): string {
  if (!url) return "";
  void trackApiUsage("static-maps");
  return `<img src="${url.replace(/&/g, "&amp;")}" alt="${htmlEscape(alt)}" width="600" style="display:block;width:100%;max-width:480px;height:auto;border-radius:16px;margin:16px 0;border:2px solid #ffd6e8;" />`;
}

// NOTE: this domain must be verified in Resend (Domains → add cutelyask.me →
// DNS records) before any email will actually send. Override via env if needed.
const FROM = process.env.EMAIL_FROM ?? "Date Night <invites@cutelyask.me>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function sendPlanNotificationEmail({
  senderEmail,
  recipientName,
  selectedDateLabel,
  planId,
}: {
  senderEmail: string;
  recipientName: string;
  selectedDateLabel: string | null;
  planId: string;
}) {
  const link = `${SITE_URL}/plan/${planId}`;

  const { error: sendError } = await getResend().emails.send({
    from: FROM,
    to: senderEmail,
    subject: `${recipientName} locked in the plan! 🎉`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #fff7fb; padding: 32px; border-radius: 24px;">
        <h1 style="color: #3a2530; font-size: 24px; margin-bottom: 8px;">It's a date! 🎉</h1>
        <p style="color: #8a6a78; font-size: 16px; line-height: 1.6;">
          <strong>${recipientName}</strong> just locked in the plan${selectedDateLabel ? ` for <strong>${selectedDateLabel}</strong>` : ""}.
          Your itinerary is ready.
        </p>
        <a href="${link}" style="display: inline-block; margin: 24px 0; padding: 14px 28px; background: #ff7aaa; color: white; text-decoration: none; border-radius: 999px; font-weight: bold; font-size: 16px;">
          See the plan ✨
        </a>
        <p style="color: #c0a0b0; font-size: 13px;">
          Or paste this link: ${link}
        </p>
      </div>
    `,
  });
  if (sendError) throw new Error(sendError.message);
}

export async function sendSpotReadyEmail({
  mode,
  recipientEmail,
  recipientName,
  senderName,
  selectedDateLabel,
  selectedTimeLabel,
  planId,
  venues,
}: {
  mode: "share" | "surprise";
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  selectedDateLabel: string | null;
  selectedTimeLabel: string | null;
  planId: string;
  venues: { name: string; address: string; lat?: number; lng?: number }[];
}) {
  const planLink = `${SITE_URL}/plan/${planId}`;
  const when = [selectedDateLabel, selectedTimeLabel].filter(Boolean).join(" at ");

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
      ? `${senderName} just locked in the spots! 📍`
      : `The plan is set — see you soon ✨`;

  const venueListHtml =
    mode === "share" && venues.length
      ? `<ul style="padding:0;margin:16px 0;list-style:none;">
          ${venues
            .map(
              (v) =>
                `<li style="margin-bottom:10px;padding:12px;background:#fff7fb;border-radius:12px;">
                  <strong style="color:#3a2530">${v.name}</strong><br>
                  <span style="color:#8a6a78;font-size:13px">${v.address}</span>
                </li>`,
            )
            .join("")}
        </ul>`
      : "";

  const body =
    mode === "share"
      ? `<p style="color:#8a6a78;font-size:16px;line-height:1.6;">
          <strong>${senderName}</strong> just picked the spots for your date${when ? ` on <strong>${when}</strong>` : ""}. Here's where you're going:
        </p>
        ${venueListHtml}
        ${mapHtml}
        <a href="${planLink}" style="display:inline-block;margin:20px 0;padding:14px 28px;background:#ff7aaa;color:white;text-decoration:none;border-radius:999px;font-weight:bold;font-size:15px;">
          See the full plan ✨
        </a>`
      : `<p style="color:#8a6a78;font-size:16px;line-height:1.6;">
          <strong>${senderName}</strong> has everything planned${when ? ` for <strong>${when}</strong>` : ""}.
          Just show up ready — the rest is a surprise. 🎁
        </p>
        <p style="color:#c0a0b0;font-size:14px;margin-top:16px;">
          All the details will be waiting for you when it's time.
        </p>`;

  const { error: sendError } = await getResend().emails.send({
    from: FROM,
    to: recipientEmail,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#fff7fb;padding:32px;border-radius:24px;">
        <h1 style="color:#3a2530;font-size:24px;margin-bottom:8px;">Hey ${recipientName}! 💌</h1>
        ${body}
        <p style="color:#c0a0b0;font-size:12px;margin-top:24px;">Planned with Date Night App 🌸</p>
      </div>
    `,
  });
  if (sendError) throw new Error(sendError.message);
}

// F4: gentle heads-up when a shared date gets called off. No guilt, no details.
export async function sendDateCanceledEmail({
  recipientEmail,
  recipientName,
  senderName,
  selectedDateLabel,
}: {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  selectedDateLabel: string | null;
}) {
  const { error: sendError } = await getResend().emails.send({
    from: FROM,
    to: recipientEmail,
    subject: `A little change of plans 💌`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#fff7fb;padding:32px;border-radius:24px;">
        <h1 style="color:#3a2530;font-size:24px;margin-bottom:8px;">Hey ${recipientName} 💌</h1>
        <p style="color:#8a6a78;font-size:16px;line-height:1.6;">
          ${selectedDateLabel ? `The plan for <strong>${selectedDateLabel}</strong>` : "The plan"} was called off — more soon 💌
        </p>
        <p style="color:#c0a0b0;font-size:14px;margin-top:16px;">
          ${senderName} will make it up to you. Promise.
        </p>
        <p style="color:#c0a0b0;font-size:12px;margin-top:24px;">Planned with Date Night App 🌸</p>
      </div>
    `,
  });
  if (sendError) throw new Error(sendError.message);
}

export async function sendInviteEmail({
  recipientName,
  recipientEmail,
  senderName,
  token,
  location,
}: {
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  token: string;
  /** Free-text date city ("Austin, TX") - teased as a soft map when present. */
  location?: string | null;
}) {
  const link = `${SITE_URL}/invite/${token}`;

  // No venues exist yet at invite time, so the teaser is just the city -
  // Static Maps geocodes the address string itself, no markers needed.
  const mapHtml = location
    ? staticMapImgHtml(
        signedStaticMapUrl({ center: location, zoom: 12, style: "soft" }),
        `A map of ${location}`,
      )
    : "";

  const { error: sendError } = await getResend().emails.send({
    from: FROM,
    to: recipientEmail,
    subject: `${senderName} wants to plan a date with you 💌`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #fff7fb; padding: 32px; border-radius: 24px;">
        <h1 style="color: #3a2530; font-size: 24px; margin-bottom: 8px;">Hey ${recipientName}! 💌</h1>
        <p style="color: #8a6a78; font-size: 16px; line-height: 1.6;">
          <strong>${senderName}</strong> wants to plan a date night with you.
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
  });
  if (sendError) throw new Error(sendError.message);
}
