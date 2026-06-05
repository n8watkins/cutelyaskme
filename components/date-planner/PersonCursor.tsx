"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

export function PersonCursor() {
  const reduceMotion = useReducedMotion();
  const [point, setPoint] = useState({ x: -100, y: -100 });

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    function handleMove(event: MouseEvent) {
      setPoint({ x: event.clientX, y: event.clientY });
    }

    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [reduceMotion]);

  if (reduceMotion) {
    return null;
  }

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-30 hidden h-10 w-10 place-items-center rounded-full border-2 border-[#3a2530] bg-[#fff3d6] text-xl shadow-[0_10px_20px_rgba(58,37,48,0.16)] sm:grid"
      animate={{ x: point.x + 12, y: point.y + 12 }}
      transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.4 }}
    >
      🙂
    </motion.div>
  );
}
