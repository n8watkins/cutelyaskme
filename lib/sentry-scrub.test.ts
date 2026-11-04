import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/core";
import { scrubBreadcrumb, scrubEvent } from "./sentry-scrub";

describe("Sentry scrubbers", () => {
  it("keeps the error and the path, nothing personal", () => {
    const event = scrubEvent({
      type: undefined,
      user: { email: "someone@example.com", ip_address: "1.2.3.4" },
      request: {
        url: "https://cutelyaskme.n8builds.dev/plan/abc?code=secret#top",
        data: { note: "private" },
        cookies: { session: "x" },
        headers: { cookie: "session=x" },
        query_string: "code=secret",
      },
      exception: { values: [{ type: "Error", value: "boom" }] },
    } as ErrorEvent);
    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({ url: "https://cutelyaskme.n8builds.dev/plan/abc" });
    expect(event.exception?.values?.[0]?.value).toBe("boom");
  });

  it("masks emails and tokens in error messages, as the logs do", () => {
    const event = scrubEvent({ type: undefined, exception: { values: [{ type: "Error", value: "no user someone@example.com" }] } } as ErrorEvent);
    expect(event.exception?.values?.[0]?.value).toBe("no user [email]");
  });

  it("drops console breadcrumbs and query strings", () => {
    expect(scrubBreadcrumb({ category: "console", message: "anything" })).toBeNull();
    expect(scrubBreadcrumb({ category: "fetch", data: { url: "/api/x?token=1", method: "GET" } })?.data).toEqual({ url: "/api/x", method: "GET" });
  });
});
