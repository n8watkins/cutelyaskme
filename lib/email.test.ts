import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("@/lib/email-delivery", () => ({ deliverEmail: mocks.send }));

const { sendInviteEmail, sendPlanNotificationEmail, sendSpotReadyEmail } =
  await import("./email");

describe("email HTML rendering", () => {
  beforeEach(() => {
    mocks.send.mockReset();
    mocks.send.mockResolvedValue(undefined);
  });

  it("escapes invite names and encodes the capability token", async () => {
    await sendInviteEmail({
      recipientName: '<img src=x onerror="alert(1)">',
      recipientEmail: "recipient@example.com",
      senderName: "Sender\r\nBcc: attacker@example.com<script>alert(1)</script>",
      token: "../other?admin=true",
    });

    const message = mocks.send.mock.calls[0][1] as { subject: string; html: string };
    expect(message.subject).not.toMatch(/[\r\n]/);
    expect(message.html).not.toContain("<script>alert(1)</script>");
    expect(message.html).not.toContain("<img src=x");
    expect(message.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(message.html).toContain("..%2Fother%3Fadmin%3Dtrue");
  });

  it("passes the durable delivery key through for retry dedupe", async () => {
    await sendInviteEmail({
      recipientName: "Recipient",
      recipientEmail: "recipient@example.com",
      senderName: "Sender",
      token: "invite-token",
      deliveryKey: "job-123",
    });

    expect(mocks.send).toHaveBeenCalledWith(
      "invite",
      expect.objectContaining({ deliveryKey: "job-123", to: "recipient@example.com" }),
    );
  });

  it("routes signed-out senders through validated plan login", async () => {
    await sendPlanNotificationEmail({
      senderEmail: "sender@example.com",
      recipientName: "Recipient",
      selectedDateLabel: "Friday",
      planId: "plan-1",
    });

    const message = mocks.send.mock.calls[0][1] as { html: string };
    expect(message.html).toContain("login?returnTo=%2Fplan%2Fplan-1");
    expect(message.html).not.toContain('href="http://localhost:3000/plan/plan-1"');
  });

  it("escapes shared venue details and date labels", async () => {
    await sendSpotReadyEmail({
      mode: "share",
      recipientEmail: "recipient@example.com",
      recipientName: "Recipient",
      senderName: "Sender",
      selectedDateLabel: "Friday <svg onload=alert(1)>",
      selectedTimeLabel: "7:00 PM",
      planId: "plan-1",
      venues: [{ name: "Cafe <script>x</script>", address: '1 Main "Street"' }],
    });

    const message = mocks.send.mock.calls[0][1] as { html: string };
    expect(message.html).not.toContain("<svg onload=alert(1)>");
    expect(message.html).not.toContain("<script>x</script>");
    expect(message.html).toContain("Friday &lt;svg onload=alert(1)&gt;");
    expect(message.html).toContain("Cafe &lt;script&gt;x&lt;/script&gt;");
    expect(message.html).toContain("1 Main &quot;Street&quot;");
    expect(message.html).toContain(
      "login?returnTo=%2Fplan%2Fplan-1",
    );
  });

  it("preserves anonymous invite redemption for unclaimed plans", async () => {
    await sendSpotReadyEmail({
      mode: "surprise",
      recipientEmail: "recipient@example.com",
      recipientName: "Recipient",
      senderName: "Sender",
      selectedDateLabel: null,
      selectedTimeLabel: null,
      planId: "plan-1",
      inviteToken: "invite-token",
      venues: [],
    });

    const message = mocks.send.mock.calls[0][1] as { html: string };
    expect(message.html).toContain("api/invites/redeem?token=invite-token");
    expect(message.html).not.toContain("login?returnTo=");
  });
});
