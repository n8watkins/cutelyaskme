import { SignInGate } from "@/components/SignInGate";
import { validatedLoginReturnPath } from "@/lib/login-return";

export const metadata = {
  title: "Sign in - Cutely Ask Me",
  robots: { index: false, follow: false },
};

type Param = string | string[] | undefined;

// Signed-out visits to protected pages are rewritten here by src/proxy.ts, so
// the address bar keeps the page they asked for and the sign-in modal opens on
// top. Direct /login links (older emails and buttons) land here too.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: Param; redirect_url?: Param; redirect?: Param }>;
}) {
  const params = await searchParams;
  const returnTo =
    validatedLoginReturnPath(params.returnTo) ??
    validatedLoginReturnPath(params.redirect_url) ??
    validatedLoginReturnPath(params.redirect) ??
    "/dashboard";
  return <SignInGate returnTo={returnTo} />;
}
