"use client";

import { useState } from "react";
import { primaryClass, secondaryClass } from "@/components/proposal/ui";

// The hero visual: a live, tiny version of the real ask. The No button
// hops between three spots (positions are classes, not inline styles).
const NO_SPOTS = ["", "-translate-x-24 -translate-y-14", "translate-x-28 translate-y-10"];

export function MiniAsk() {
  const [hops, setHops] = useState(0);
  const [said, setSaid] = useState(false);

  return (
    <div className="relative rounded-[32px] border border-white bg-white/85 p-6 text-center shadow-[0_24px_80px_rgba(255,122,170,0.28)] sm:p-8">
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-lavender px-3 py-1 text-xs font-black text-white">
        Live demo
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG sticker; next/image adds an inline style the CSP blocks */}
      <img
        src="/assets/heart-envelope.svg"
        alt=""
        width={96}
        height={96}
        className="mx-auto h-20 w-20"
      />
      {said ? (
        <div role="status" className="py-6">
          <p className="text-3xl font-black">Yay! 💞</p>
          <p className="mt-2 text-muted">Next they pick the day, the time and the vibe.</p>
          <button type="button" onClick={() => { setSaid(false); setHops(0); }} className={`${secondaryClass("sm")} mt-5`}>
            Play again
          </button>
        </div>
      ) : (
        <>
          <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-muted">Tiny date delivery</p>
          <p className="mt-1 text-3xl font-black">Sam…</p>
          <p className="mt-3 text-2xl font-black leading-tight">Will you go on a date with me?</p>
          <div className="relative mt-7 flex items-center justify-center gap-3">
            <button type="button" onClick={() => setSaid(true)} className={primaryClass("lg")}>
              Yes! ♥
            </button>
            <button
              type="button"
              onPointerEnter={() => setHops((h) => h + 1)}
              onClick={() => setHops((h) => h + 1)}
              className={`${secondaryClass("md")} transition-transform duration-300 motion-reduce:transition-none ${NO_SPOTS[hops % NO_SPOTS.length]}`}
            >
              No
            </button>
          </div>
          <p aria-live="polite" className="mt-5 min-h-5 text-sm font-bold text-muted">
            {hops === 0 ? "" : hops < 3 ? "Hmm, the No button is shy." : "It really doesn't want to be pressed."}
          </p>
        </>
      )}
    </div>
  );
}
