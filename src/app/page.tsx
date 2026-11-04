import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-4 text-6xl">💌</div>
      <h1 className="text-4xl font-black text-[#3a2530]">Cutely Ask Me</h1>
      <p className="mt-2 max-w-xs text-[#8a6a78]">
        Plan a date, send an invite, and let them pick what sounds good.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/send"
          className="rounded-full bg-[#ff7aaa] px-6 py-3 font-black text-white shadow-[0_8px_20px_rgba(255,122,170,0.32)] hover:brightness-105"
        >
          Plan a date
        </Link>
        <Link
          href="/login"
          className="rounded-full border-2 border-[#ffd6e8] bg-white px-6 py-3 font-black text-[#8a6a78] hover:bg-[#fff7fb]"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
