import { SignIn } from "@clerk/nextjs";
import { SIGN_IN_PATH, SIGN_UP_PATH } from "@/lib/auth-routes";
import { validatedLoginReturnPath } from "@/lib/login-return";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const returnTo = validatedLoginReturnPath((await searchParams).returnTo);
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mb-3 text-5xl">💌</div>
        <h1 className="text-3xl font-black text-[#3a2530]">Sign in</h1>
        <p className="mt-1 text-sm text-[#8a6a78]">
          To send a date invite
        </p>
      </div>
      <SignIn
        path={SIGN_IN_PATH}
        routing="path"
        signUpUrl={
          returnTo
            ? `${SIGN_UP_PATH}?returnTo=${encodeURIComponent(returnTo)}`
            : SIGN_UP_PATH
        }
        forceRedirectUrl={returnTo}
      />
    </main>
  );
}
