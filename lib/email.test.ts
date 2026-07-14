import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));

process.env.RESEND_API_KEY = "test-key";

const { sendInviteEmail, sendSpotReadyEmail } = await import("./email");

describe("email HTML rendering", () => {
  beforeEach(() => {
    mocks.send.mockReset();
    mocks.send.mockResolvedValue({ error: null });
  });

  it("escapes invite names and encodes the capability token", async () => {
    await sendInviteEmail({
      recipientName: '<img src=x onerror="alert(1)">',
      recipientEmail: "recipient@example.com",
      senderName: "Sender\r\nBcc: attacker@example.com<script>alert(1)</script>",
      token: "../other?admin=true",
    });

    const message = mocks.send.mock.calls[0][0] as { subject: string; html: string };
    expect(message.subject).not.toMatch(/[\r\n]/);
    expect(message.html).not.toContain("<script>alert(1)</script>");
    expect(message.html).not.toContain("<img src=x");
    expect(message.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(message.html).toContain("..%2Fother%3Fadmin%3Dtrue");
  });

  it("passes the durable delivery key to Resend for retry idempotency", async () => {
    await sendInviteEmail({
      recipientName: "Recipient",
      recipientEmail: "recipient@example.com",
      senderName: "Sender",
      token: "invite-token",
      deliveryKey: "job-123",
    });

    expect(mocks.send).toHaveBeenCalledWith(
      expect.any(Object),
      { idempotencyKey: "job-123" },
    );
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

    const message = mocks.send.mock.calls[0][0] as { html: string };
    expect(message.html).not.toContain("<svg onload=alert(1)>");
    expect(message.html).not.toContain("<script>x</script>");
    expect(message.html).toContain("Friday &lt;svg onload=alert(1)&gt;");
    expect(message.html).toContain("Cafe &lt;script&gt;x&lt;/script&gt;");
    expect(message.html).toContain("1 Main &quot;Street&quot;");
  });
});
