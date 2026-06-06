import { Resend } from "resend";

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = "Date Night <invites@datenightapp.com>";
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

export async function sendInviteEmail({
  recipientName,
  recipientEmail,
  senderName,
  token,
}: {
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  token: string;
}) {
  const link = `${SITE_URL}/invite/${token}`;

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
