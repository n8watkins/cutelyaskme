import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  buildContentSecurityPolicy,
  generateCspNonce,
} from "@/lib/content-security-policy";

// Next 16 "proxy" file convention (formerly middleware.ts — identical behavior).
// Only the sender's own pages require auth. /invite and /plan must stay public
// so a recipient can open a shared link and respond WITHOUT an account — the
// /plan page does its own per-viewer authorization. /login stays public too.
const isProtected = createRouteMatcher(["/send(.*)", "/dashboard(.*)", "/settings(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtected(request)) await auth.protect();

  const nonce = generateCspNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  requestHeaders.set("X-Nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
