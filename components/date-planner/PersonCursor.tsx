"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useHydratedReducedMotion } from "./useHydratedReducedMotion";

export function PersonCursor({ message, avatarSrc }: { message: string | null; avatarSrc: string | null }) {
  const reduceMotion = useHydratedReducedMotion();
  const [point, setPoint] = useState({ x: -100, y: -100 });

  useEffect(() => {
    if (reduceMotion) return;
    function handleMove(event: MouseEvent) {
      setPoint({ x: event.clientX, y: event.clientY });
    }
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [reduceMotion]);

  if (reduceMotion) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-30 hidden sm:block"
      animate={{ x: point.x + 12, y: point.y + 12 }}
      transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.4 }}
    >
      {message ? (
        <motion.div
          key={message}
          initial={{ opacity: 0, x: 6, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          className="absolute left-12 top-0 w-max max-w-56 rounded-[22px] border-2 border-[#ffd6e8] bg-white px-4 py-3 text-center text-sm font-black leading-tight text-[#8a6a78] shadow-[0_12px_28px_rgba(255,122,170,0.2)] after:absolute after:left-[-7px] after:top-5 after:h-3 after:w-3 after:rotate-45 after:border-b-2 after:border-l-2 after:border-[#ffd6e8] after:bg-white"
        >
          {message}
        </motion.div>
      ) : null}
      <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border-2 border-[#3a2530] bg-[#fff3d6] text-xl shadow-[0_10px_20px_rgba(58,37,48,0.16)]">
        {avatarSrc
          // eslint-disable-next-line @next/next/no-img-element -- data-URL avatar, next/image can't optimize it
          ? <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
          : <span>🙂</span>
        }
      </div>
    </motion.div>
  );
}
