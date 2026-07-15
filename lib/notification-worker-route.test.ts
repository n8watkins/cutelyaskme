import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const delivery = vi.hoisted(() => ({
  run: vi.fn(async () => ({ sent: 2, failed: 1, exhausted: 1, canceled: 1 })),
}));

vi.mock("./notification-delivery", () => ({
  deliverPendingNotificationJobs: delivery.run,
}));

import { GET } from "../src/app/api/notifications/process/route";

const originalCronSecret = process.env.CRON_SECRET;
const originalWorkerSecret = process.env.NOTIFICATION_WORKER_SECRET;

function request(authorization?: string): NextRequest {
  return new NextRequest("http://localhost/api/notifications/process", {
    headers: authorization ? { authorization } : undefined,
  });
}

describe.sequential("notification worker route", () => {
  it("uses the queue for prompt delivery and a Hobby-compatible daily reconciliation", async () => {
    const deployment = JSON.parse(
      await readFile("vercel.json", "utf8"),
    ) as {
      crons: Array<{ path: string; schedule: string }>;
      functions: Record<
        string,
        { experimentalTriggers: Array<Record<string, string | number>> }
      >;
    };

    expect(deployment.crons).toContainEqual({
      path: "/api/notifications/process",
      schedule: "0 3 * * *",
    });
    expect(
      deployment.functions["src/app/api/queues/notifications/route.ts"]
        ?.experimentalTriggers,
    ).toContainEqual({
      type: "queue/v2beta",
      topic: "notification-delivery",
      retryAfterSeconds: 120,
      initialDelaySeconds: 0,
    });
  });

  beforeEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.NOTIFICATION_WORKER_SECRET;
    delivery.run.mockReset();
    delivery.run.mockResolvedValue({
      sent: 2,
      failed: 1,
      exhausted: 1,
      canceled: 1,
    });
  });

  afterAll(() => {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
    if (originalWorkerSecret === undefined) delete process.env.NOTIFICATION_WORKER_SECRET;
    else process.env.NOTIFICATION_WORKER_SECRET = originalWorkerSecret;
  });

  it("stays unavailable until at least one worker secret is configured", async () => {
    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(delivery.run).not.toHaveBeenCalled();
  });

  it("rejects missing, malformed, and incorrect bearer credentials", async () => {
    process.env.CRON_SECRET = "cron-secret";

    await expect(GET(request())).resolves.toMatchObject({ status: 401 });
    await expect(GET(request("Basic cron-secret"))).resolves.toMatchObject({ status: 401 });
    await expect(GET(request("Bearer wrong-secret"))).resolves.toMatchObject({ status: 401 });
    expect(delivery.run).not.toHaveBeenCalled();
  });

  it("accepts the Vercel cron secret and drains a bounded batch", async () => {
    process.env.CRON_SECRET = "cron-secret";

    const response = await GET(request("Bearer cron-secret"));

    expect(response.status).toBe(200);
    expect(delivery.run).toHaveBeenCalledWith(20);
    expect(await response.json()).toEqual({
      processed: 5,
      sent: 2,
      failed: 1,
      exhausted: 1,
      canceled: 1,
    });
  });

  it("drains additional reconciliation batches while work remains", async () => {
    process.env.CRON_SECRET = "cron-secret";
    delivery.run
      .mockResolvedValueOnce({ sent: 20, failed: 0, exhausted: 0, canceled: 0 })
      .mockResolvedValueOnce({ sent: 3, failed: 1, exhausted: 0, canceled: 1 });

    const response = await GET(request("Bearer cron-secret"));

    expect(delivery.run).toHaveBeenCalledTimes(2);
    expect(delivery.run).toHaveBeenNthCalledWith(1, 20);
    expect(delivery.run).toHaveBeenNthCalledWith(2, 20);
    expect(await response.json()).toEqual({
      processed: 25,
      sent: 23,
      failed: 1,
      exhausted: 0,
      canceled: 1,
    });
  });

  it("bounds reconciliation when every batch is full", async () => {
    process.env.CRON_SECRET = "cron-secret";
    delivery.run.mockResolvedValue({ sent: 20, failed: 0, exhausted: 0, canceled: 0 });

    const response = await GET(request("Bearer cron-secret"));

    expect(delivery.run).toHaveBeenCalledTimes(5);
    expect(await response.json()).toEqual({
      processed: 100,
      sent: 100,
      failed: 0,
      exhausted: 0,
      canceled: 0,
    });
  });

  it("retains a separate secret for manual worker invocations", async () => {
    process.env.CRON_SECRET = "cron-secret";
    process.env.NOTIFICATION_WORKER_SECRET = "manual-secret";

    const response = await GET(request("Bearer manual-secret"));

    expect(response.status).toBe(200);
    expect(delivery.run).toHaveBeenCalledWith(20);
  });
});
