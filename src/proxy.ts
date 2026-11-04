import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  buildContentSecurityPolicy,
  generateCspNonce,
} from "@/lib/content-security-policy";
import { SIGN_IN_PATH, SIGN_UP_PATH } from "@/lib/auth-routes";
import { isPrototypeEnabled, isPrototypePath } from "@/lib/prototype";

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

  // The UX prototype never reaches a production visitor: render the 404 page.
  const prototypePath = isPrototypePath(request.nextUrl.pathname);
  const hidePrototype = prototypePath && !isPrototypeEnabled();
  const response = hidePrototype
    ? NextResponse.rewrite(new URL("/_prototype-not-served", request.url), {
        status: 404,
        request: { headers: requestHeaders },
      })
    : NextResponse.next({
        request: { headers: requestHeaders },
      });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  // Keep the prototype out of search indexes wherever it is turned on.
  if (prototypePath) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}, {
  // Send signed-out visitors of protected pages to the app's own sign-in page.
  // Without these, auth.protect() redirects to Clerk's hosted page, which the
  // CSP blocks for prefetches and which leaves the app's address.
  signInUrl: SIGN_IN_PATH,
  signUpUrl: SIGN_UP_PATH,
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
