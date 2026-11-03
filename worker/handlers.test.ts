import { beforeEach, describe, expect, it, vi } from "vitest";

import { createWorker, type FetchHandler } from "./handlers";

// The OpenNext handler is a build artifact, so the test stands in for it and
// checks what the queue and cron handlers ask of it.
const openNext = { fetch: vi.fn() };

type Summary = { processed: number; sent: number; failed: number; exhausted: number; canceled: number };

function summary(processed: number): Summary {
  return { processed, sent: processed, failed: 0, exhausted: 0, canceled: 0 };
}

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    CRON_SECRET: "cron-secret",
    NOTIFICATION_QUEUE: { send: vi.fn().mockResolvedValue(undefined) },
    ...overrides,
  };
}

function makeBatch(ids: string[]) {
  return {
    queue: "cutelyaskme-notification-delivery",
    messages: ids.map((id) => ({ id, attempts: 1, body: { version: 1, reason: "new", key: id } })),
    ackAll: vi.fn(),
    retryAll: vi.fn(),
  };
}

const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn(), props: {} };

// The handlers are typed against the Workers runtime; the fakes above only
// carry the fields they read.
type Handlers = {
  queue(batch: unknown, env: unknown, ctx: unknown): Promise<void>;
  scheduled(controller: unknown, env: unknown, ctx: unknown): Promise<void>;
};
const handlers = createWorker(openNext as unknown as FetchHandler) as unknown as Handlers;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("Worker queue consumer", () => {
  it("drains the outbox in-process with the cron secret and acks the batch", async () => {
    openNext.fetch.mockResolvedValue(Response.json(summary(3)));
    const env = makeEnv();
    const batch = makeBatch(["m1", "m2"]);

    await handlers.queue(batch, env, ctx);

    expect(openNext.fetch).toHaveBeenCalledTimes(1);
    const [request] = openNext.fetch.mock.calls[0] as [Request];
    expect(new URL(request.url).pathname).toBe("/api/notifications/process");
    expect(request.method).toBe("GET");
    expect(request.headers.get("authorization")).toBe("Bearer cron-secret");
    // A host header matching the URL keeps OpenNext from proxying the call.
    expect(request.headers.get("host")).toBe(new URL(request.url).host);
    expect(batch.ackAll).toHaveBeenCalled();
    expect(batch.retryAll).not.toHaveBeenCalled();
    expect(env.NOTIFICATION_QUEUE.send).not.toHaveBeenCalled();
  });

  it("sends a continuation when the drain used its whole capacity", async () => {
    openNext.fetch.mockResolvedValue(Response.json(summary(100)));
    const env = makeEnv();
    const batch = makeBatch(["m1"]);

    await handlers.queue(batch, env, ctx);

    expect(env.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith({
      version: 1,
      reason: "continue",
      key: "notification-continuation:m1",
    });
    expect(batch.ackAll).toHaveBeenCalled();
  });

  it("retries the batch after 120 seconds when the drain fails", async () => {
    openNext.fetch.mockResolvedValue(new Response("down", { status: 503 }));
    const batch = makeBatch(["m1"]);

    await handlers.queue(batch, makeEnv(), ctx);

    expect(batch.retryAll).toHaveBeenCalledWith({ delaySeconds: 120 });
    expect(batch.ackAll).not.toHaveBeenCalled();
    expect(JSON.parse(String(vi.mocked(console.error).mock.calls.at(-1)?.[0]))).toEqual({
      event: "notification_queue_drain_failed",
      reason: "drain_failed",
      route: "queue:cutelyaskme-notification-delivery",
      messages: 1,
      attempt: 1,
      retryInSeconds: 120,
      error: "Error: notification drain failed with status 503",
    });
  });

  it("retries rather than calling the route when CRON_SECRET is missing", async () => {
    const batch = makeBatch(["m1"]);

    await handlers.queue(batch, makeEnv({ CRON_SECRET: "" }), ctx);

    expect(openNext.fetch).not.toHaveBeenCalled();
    expect(batch.retryAll).toHaveBeenCalledWith({ delaySeconds: 120 });
  });
});

describe("Worker cron trigger", () => {
  it("runs the daily reconciliation through the process route", async () => {
    openNext.fetch.mockResolvedValue(Response.json(summary(7)));

    await handlers.scheduled({ cron: "0 3 * * *", scheduledTime: 0 }, makeEnv(), ctx);

    const [request] = openNext.fetch.mock.calls[0] as [Request];
    expect(new URL(request.url).pathname).toBe("/api/notifications/process");
    expect(request.headers.get("authorization")).toBe("Bearer cron-secret");
  });

  it("fails the cron run when the route fails, so it shows as an error", async () => {
    openNext.fetch.mockResolvedValue(new Response("nope", { status: 500 }));

    await expect(
      handlers.scheduled({ cron: "0 3 * * *", scheduledTime: 0 }, makeEnv(), ctx),
    ).rejects.toThrow("status 500");
  });
});
