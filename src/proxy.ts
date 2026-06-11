import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next 16 "proxy" file convention (formerly middleware.ts — identical behavior).
// Only the sender's own pages require auth. /invite and /plan must stay public
// so a recipient can open a shared link and respond WITHOUT an account — the
// /plan page does its own per-viewer authorization. /login stays public too.
const isProtected = createRouteMatcher(["/send(.*)", "/dashboard(.*)", "/settings(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtected(request)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
