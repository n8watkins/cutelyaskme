import { describe, expect, it } from "vitest";
import nextConfig, { securityHeaders } from "../next.config";
import {
  buildContentSecurityPolicy,
  generateCspNonce,
} from "./content-security-policy";

describe("security response headers", () => {
  it("applies the baseline headers to every route", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(nextConfig.headers).toBeTypeOf("function");

    const rules = await nextConfig.headers!();
    expect(rules).toEqual([{ source: "/:path*", headers: [...securityHeaders] }]);
    expect(Object.fromEntries(securityHeaders.map(({ key, value }) => [key, value]))).toMatchObject({
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
  });

  it("uses a strict nonce CSP while allowing required services", () => {
    const contentSecurityPolicy = buildContentSecurityPolicy("test-nonce", false);

    expect(contentSecurityPolicy).toContain("default-src 'self'");
    expect(contentSecurityPolicy).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'");
    expect(contentSecurityPolicy).toContain("script-src-attr 'none'");
    // Styles: the request nonce plus two exact hashes Clerk needs (an empty
    // stylesheet and the one-time-code caret keyframes), nothing broader.
    const styleSrc = contentSecurityPolicy.split("; ").find((d) => d.startsWith("style-src "));
    expect(styleSrc).toBe(
      "style-src 'self' 'nonce-test-nonce' " +
        "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=' " +
        "'sha256-KQDhUccuEkZUQDnfbVDeY+ev2LZ+73AQR7ro4JppAY8=' " +
        "https://fonts.googleapis.com",
    );
    expect(contentSecurityPolicy).toContain("object-src 'none'");
    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
    expect(contentSecurityPolicy).toContain("https://*.clerk.accounts.dev");
    expect(contentSecurityPolicy).toContain("https://*.googleapis.com");
    expect(contentSecurityPolicy).toContain("https://api.cloudinary.com");
    expect(contentSecurityPolicy).not.toContain("'unsafe-inline'");
    expect(contentSecurityPolicy).not.toContain("'unsafe-eval'");
    expect(contentSecurityPolicy).not.toContain("default-src *");
  });

  it("only permits development runtime exceptions in development", () => {
    const contentSecurityPolicy = buildContentSecurityPolicy("test-nonce", true);

    expect(contentSecurityPolicy).toContain("'unsafe-eval'");
    expect(contentSecurityPolicy).toContain("style-src 'self' 'unsafe-inline'");
    expect(contentSecurityPolicy.match(/'unsafe-inline'/g)).toHaveLength(1);
  });

  it("generates a fresh 128-bit nonce", () => {
    const first = generateCspNonce();
    const second = generateCspNonce();

    expect(first).not.toBe(second);
    expect(atob(first)).toHaveLength(16);
    expect(atob(second)).toHaveLength(16);
  });
});
