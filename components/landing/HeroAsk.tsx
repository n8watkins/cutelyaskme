"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { EvasiveNoButton } from "@/components/date-planner/EvasiveNoButton";
import { DEMO_ASK_PATH } from "@/lib/landing";

// The hero shows the product: the real ask, with the real runaway No button
// (components/date-planner/EvasiveNoButton), framed like a phone. Nothing here
// is saved; "Yes" only points on to the full demo ask.
export function HeroAsk() {
  const yesButtonRef = useRef<HTMLButtonElement>(null);
  const [attempts, setAttempts] = useState(0);
  const [commentary, setCommentary] = useState("");
  const [saidYes, setSaidYes] = useState(false);

  return (
    <figure aria-label="A preview of the ask" className="relative isolate mx-auto w-full max-w-[22.5rem] lg:max-w-[24rem]">
      <div
        aria-hidden
        className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(circle,rgba(255,122,170,0.28),transparent_68%)] blur-2xl"
      />
      <div className="rounded-[44px] border border-white bg-white/60 p-2.5 shadow-[0_30px_80px_rgba(201,58,115,0.22)] backdrop-blur">
        <div className="relative rounded-[36px] bg-gradient-to-b from-[#fff0f7] via-white to-[#f5f0ff] px-5 pb-6 pt-9 text-center">
          <span
            aria-hidden
            className="absolute left-1/2 top-3 h-1.5 w-16 -translate-x-1/2 rounded-full bg-petal"
          />
          <span className="absolute right-4 top-4 rounded-full bg-lavender px-2.5 py-0.5 text-xs font-black text-white">
            Demo
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG sticker; next/image adds an inline style the CSP blocks */}
          <img
            src="/assets/heart-envelope.svg"
            alt=""
            width={96}
            height={96}
            className="mx-auto h-20 w-20 drop-shadow-[0_14px_22px_rgba(255,122,170,0.22)]"
          />
          {saidYes ? (
            <div role="status" className="flex min-h-[19rem] flex-col items-center justify-center">
              <p className="text-4xl font-black text-ink">Yay! 💞</p>
              <p className="mt-3 max-w-[15rem] text-base font-semibold leading-7 text-muted">
                Next, Sam picks the day, the time and the vibe.
              </p>
              <Link
                href={DEMO_ASK_PATH}
                className="mt-6 inline-flex min-h-12 items-center rounded-full bg-pink-strong px-6 font-black text-white shadow-[0_10px_24px_rgba(201,58,115,0.28)] outline-none hover:brightness-110 focus-visible:ring-4 focus-visible:ring-petal"
              >
                Keep going in the demo
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSaidYes(false);
                  setAttempts(0);
                  setCommentary("");
                }}
                className="mt-3 min-h-11 rounded-full px-4 text-sm font-black text-muted underline-offset-4 outline-none hover:text-ink hover:underline focus-visible:ring-4 focus-visible:ring-petal"
              >
                Ask again
              </button>
            </div>
          ) : (
            <>
              <p className="mt-3 text-sm font-black text-muted">Tiny date delivery</p>
              <p className="mt-1 text-4xl font-black leading-none text-ink">Sam...</p>
              <p className="mt-4 text-balance text-2xl font-black leading-tight text-ink">
                Will you go on a date with me?
              </p>
              <div className="relative mt-2 grid min-h-48 place-items-center">
                <button
                  ref={yesButtonRef}
                  type="button"
                  onClick={() => setSaidYes(true)}
                  className="min-h-16 min-w-36 rounded-full bg-pink px-8 py-4 text-xl font-black text-white shadow-[0_18px_38px_rgba(255,122,170,0.4)] outline-none transition hover:scale-105 focus-visible:ring-4 focus-visible:ring-petal"
                >
                  Yes! ♥
                </button>
                <EvasiveNoButton
                  attempts={attempts}
                  yesButtonRef={yesButtonRef}
                  onAttempt={() => setAttempts((n) => n + 1)}
                  onCommentary={setCommentary}
                />
              </div>
              <p aria-live="polite" className="min-h-6 text-sm font-black text-pink-strong">
                {commentary ? `"${commentary}"` : ""}
              </p>
            </>
          )}
        </div>
      </div>
      <figcaption className="mt-4 text-center text-sm font-bold text-muted">
        {saidYes ? "That is the whole ask. Sweet, right?" : "Go on, try to press No."}
      </figcaption>
    </figure>
  );
}
