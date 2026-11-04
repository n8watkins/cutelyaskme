import { SignInGate } from "@/components/SignInGate";
import { validatedLoginReturnPath } from "@/lib/login-return";

export const metadata = {
  title: "Create your account - Cutely Ask Me",
  robots: { index: false, follow: false },
};

// A fallback for old /sign-up links: sign-up is a modal (components/SignInGate.tsx).
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const returnTo = validatedLoginReturnPath((await searchParams).returnTo) ?? "/dashboard";
  return <SignInGate mode="signUp" returnTo={returnTo} />;
}
