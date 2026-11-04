import Link from "next/link";
import type { ReactNode } from "react";

/** The not-found and error pages, in the home page's look: the app's mark, a
 *  heading, one sentence and the ways out. */
export default function EdgePage({
  emoji,
  label,
  title,
  children,
  actions,
}: {
  emoji: string;
  label: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-12 text-center">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-ink">
        <span aria-hidden="true">💌</span>
        <span>Cutely Ask Me</span>
      </Link>
      <div aria-hidden="true" className="mt-10 text-6xl">
        {emoji}
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-widest text-pink-strong">{label}</p>
      <h1 className="mt-2 max-w-md text-3xl font-black text-balance text-ink sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-xs text-pretty text-muted">{children}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div>
    </main>
  );
}

export const primaryAction =
  "rounded-full border-2 border-transparent bg-[#ff7aaa] px-6 py-3 font-black text-white shadow-[0_8px_20px_rgba(255,122,170,0.32)] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-strong";
export const secondaryAction =
  "rounded-full border-2 border-[#ffd6e8] bg-white px-6 py-3 font-black text-[#8a6a78] hover:bg-[#fff7fb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-strong";
