import { SignUp } from "@clerk/nextjs";
import { SIGN_IN_PATH, SIGN_UP_PATH } from "@/lib/auth-routes";
import { validatedLoginReturnPath } from "@/lib/login-return";

export const metadata = {
  title: "Create your account - Cutely Ask Me",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const returnTo = validatedLoginReturnPath((await searchParams).returnTo);
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mb-3 text-5xl" aria-hidden>
          💌
        </div>
        <h1 className="text-3xl font-black text-[#3a2530]">Join Cutely Ask Me</h1>
        <p className="mt-1 text-sm text-[#8a6a78]">
          So you can send date invites and plan the night
        </p>
      </div>
      <SignUp
        path={SIGN_UP_PATH}
        routing="path"
        signInUrl={SIGN_IN_PATH}
        forceRedirectUrl={returnTo}
      />
    </main>
  );
}
