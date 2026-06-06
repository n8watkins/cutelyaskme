import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mb-3 text-5xl">💌</div>
        <h1 className="text-3xl font-black text-[#3a2530]">Sign in</h1>
        <p className="mt-1 text-sm text-[#8a6a78]">
          To send or open a date invite
        </p>
      </div>
      <SignIn />
    </main>
  );
}
