import { describe, expect, it } from "vitest";
import { emailAppUrl, emailSubject, emailText, emailUrl } from "./email-security";

describe("email security helpers", () => {
  it("escapes untrusted HTML email text", () => {
    expect(emailText('<img src=x onerror="alert(1)"> & friends')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; friends",
    );
  });

  it("allows HTTP URLs and escapes them for attributes", () => {
    expect(emailUrl("https://example.com/plan?a=1&b=2")).toBe(
      "https://example.com/plan?a=1&amp;b=2",
    );
  });

  it("rejects active URL schemes", () => {
    expect(() => emailUrl("javascript:alert(1)")).toThrow(
      "Email URLs must use HTTP or HTTPS",
    );
  });

  it("encodes user-controlled path segments", () => {
    expect(emailAppUrl("https://cutelyask.me/root/", "plan", "../evil?a=1")).toBe(
      "https://cutelyask.me/root/plan/..%2Fevil%3Fa%3D1",
    );
  });

  it("removes line breaks from subjects", () => {
    expect(emailSubject("A name\r\nBcc: attacker@example.com")).toBe(
      "A name Bcc: attacker@example.com",
    );
  });
});
