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

// SHA-256 of the empty string. Clerk's one-time-code input (input-otp) and
// its UI framework append empty <style> elements and then fill them through
// CSSOM insertRule, which CSP does not police. Allowing only the *empty*
// stylesheet hash lets that work without permitting any inline CSS text.
export const EMPTY_STYLE_HASH = "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='";

// Clerk's one-time-code field renders one inline <style> with its blinking
// caret keyframes ("@keyframes caret-blink-animation"). Clerk UI is loaded
// from Clerk's CDN, so if they change that text the Clerk e2e spec reports
// the new hash; the only cost of a stale hash is a caret that doesn't blink.
export const CLERK_OTP_CARET_STYLE_HASH = "'sha256-KQDhUccuEkZUQDnfbVDeY+ev2LZ+73AQR7ro4JppAY8='";

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
    ...(isDevelopment ? ["'unsafe-inline'"] : [`'nonce-${nonce}'`, EMPTY_STYLE_HASH, CLERK_OTP_CARET_STYLE_HASH]),
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
      // Clerk's bot protection probes these from the sign-in and sign-up forms.
      "https://*.client.protect.clerk.com:*",
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
