import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: {} }) }));
vi.mock("@/lib/db", () => ({ getDbClient: () => undefined }));
vi.mock("@/lib/api-usage", () => ({ trackApiUsage: vi.fn() }));

const { deliverEmail, EMAIL_FROM } = await import("./email-delivery");
const { getApiLimit } = await import("./api-limits");

let dir: string;
let client: Client;
const sent: Array<{ to: string; from: { email: string; name: string }; html: string; text: string }> = [];
const binding = {
  send: vi.fn(async (message: (typeof sent)[number]) => void sent.push(message)),
};
const track = vi.fn(async () => undefined);
const now = Date.UTC(2026, 10, 10, 12);

function deps(overrides: Partial<Parameters<typeof deliverEmail>[2]> = {}) {
  return { binding, client, now: () => now, track, ...overrides };
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "email-delivery-"));
  client = createClient({ url: `file:${join(dir, "db.sqlite")}` });
  await client.execute(`
    CREATE TABLE service_budgets (
      key text PRIMARY KEY NOT NULL,
      service text NOT NULL,
      subject_id text NOT NULL,
      window_start integer NOT NULL,
      window_end integer NOT NULL,
      count integer DEFAULT 0 NOT NULL,
      limit_value integer NOT NULL
    )
  `);
  sent.length = 0;
  binding.send.mockClear();
  track.mockClear();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  client.close();
  await rm(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const email = { to: "a@example.test", subject: "Hi", html: '<p>Hello <a href="https://x.test/p?a=1&amp;b=2">go</a></p>' };

describe("deliverEmail", () => {
  it("sends from the app address with an html and a text part, and counts it", async () => {
    await deliverEmail("invite", email, deps());
    expect(sent).toHaveLength(1);
    expect(sent[0].from).toEqual(EMAIL_FROM);
    expect(sent[0].from.email).toBe("cutelyaskme@n8builds.dev");
    expect(sent[0].text).toContain("go (https://x.test/p?a=1&b=2)");
    expect(track).toHaveBeenCalledWith("email");
  });

  it("logs the kind of each send and never the address", async () => {
    await deliverEmail("spot-ready", email, deps());
    const lines = vi.mocked(console.log).mock.calls.map((c) => String(c[0]));
    expect(lines).toContain(JSON.stringify({ event: "email_sent", kind: "spot-ready" }));
    expect(lines.join("\n")).not.toContain("example.test");
  });

  it("does not send the same delivery key twice (a retried outbox job)", async () => {
    await deliverEmail("invite", { ...email, deliveryKey: "job-1" }, deps());
    await deliverEmail("invite", { ...email, deliveryKey: "job-1" }, deps());
    await deliverEmail("invite", { ...email, deliveryKey: "job-2" }, deps());
    expect(sent).toHaveLength(2);
  });

  it("leaves the key unspent when the send fails, so the retry still sends", async () => {
    binding.send.mockRejectedValueOnce(new Error("provider down"));
    await expect(deliverEmail("invite", { ...email, deliveryKey: "job-1" }, deps())).rejects.toThrow("provider down");
    await deliverEmail("invite", { ...email, deliveryKey: "job-1" }, deps());
    expect(sent).toHaveLength(1);
  });

  it("refuses once the daily cap is used up and resets the next UTC day", async () => {
    const cap = getApiLimit("email")!.dailyBudget!;
    for (let i = 0; i < cap; i++) await deliverEmail("invite", email, deps());
    await expect(deliverEmail("invite", email, deps())).rejects.toThrow("email_daily_cap");
    expect(sent).toHaveLength(cap);
    await deliverEmail("invite", email, deps({ now: () => now + 24 * 60 * 60 * 1000 }));
    expect(sent).toHaveLength(cap + 1);
  });

  it("fails with email_not_configured when there is no binding", async () => {
    await expect(deliverEmail("invite", email, deps({ binding: undefined }))).rejects.toThrow("email_not_configured");
  });
});
