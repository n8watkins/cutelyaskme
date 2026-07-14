const clerkSources = [
  "https://*.clerk.accounts.dev",
  "https://*.clerk.com",
  "https://*.clerk.dev",
];

const googleSources = [
  "https://*.google.com",
  "https://*.googleapis.com",
  "https://*.googleusercontent.com",
  "https://*.gstatic.com",
];

export function generateCspNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

export function buildContentSecurityPolicy(
  nonce: string,
  isDevelopment = process.env.NODE_ENV === "development",
): string {
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
    ...clerkSources,
    "https://challenges.cloudflare.com",
    "https://clerk-telemetry.com",
    ...googleSources,
  ];
  const styleSources = [
    "'self'",
    ...(isDevelopment ? ["'unsafe-inline'"] : [`'nonce-${nonce}'`]),
    "https://fonts.googleapis.com",
  ];

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "script-src-attr 'none'",
    `style-src ${styleSources.join(" ")}`,
    `img-src 'self' data: blob: ${[
      ...clerkSources,
      "https://img.clerk.com",
      ...googleSources,
      "https://res.cloudinary.com",
    ].join(" ")}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' ${[
      ...clerkSources,
      "https://api.clerk.com",
      "https://clerk-telemetry.com",
      "wss://*.clerk.accounts.dev",
      "wss://*.clerk.com",
      ...googleSources,
      "https://api.cloudinary.com",
      "https://res.cloudinary.com",
    ].join(" ")}`,
    `frame-src 'self' ${[
      ...clerkSources,
      "https://challenges.cloudflare.com",
    ].join(" ")}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${clerkSources.join(" ")}`,
    "frame-ancestors 'none'",
  ].join("; ");
}
