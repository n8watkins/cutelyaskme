// Single source of truth for Clerk's route paths. They are passed to
// <ClerkProvider> explicitly so a stale NEXT_PUBLIC_CLERK_SIGN_UP_URL in a
// deployment's environment can never point "Sign up" back at the sign-in page.
export const SIGN_IN_PATH = "/login";
export const SIGN_UP_PATH = "/sign-up";
