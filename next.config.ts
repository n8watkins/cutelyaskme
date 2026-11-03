import type { NextConfig } from "next";

export const securityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), autoplay=(), camera=(), clipboard-write=(self), geolocation=(self), gyroscope=(), microphone=(), payment=(), publickey-credentials-get=(self), usb=()",
  },
] as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders],
      },
      {
        // The UX prototype (src/app/proposal) 404s in production builds; this
        // keeps it out of search indexes wherever it is turned on.
        source: "/proposal/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
