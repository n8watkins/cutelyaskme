// The UX prototype under /proposal (docs/UX_PLAN_2026-11.md) ships in the repo
// but is never served by a production build: it is on under `npm run dev`, or
// with PROTOTYPE=1 (for example on a Vercel preview deployment).
export function isPrototypeEnabled(env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV === "development" || env.PROTOTYPE === "1";
}

export function isPrototypePath(pathname: string) {
  return pathname === "/proposal" || pathname.startsWith("/proposal/");
}
