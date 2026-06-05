"use client";

import { motion, useReducedMotion } from "framer-motion";

const decor = [
  { text: "♥", left: "8%", top: "14%", delay: 0 },
  { text: "✦", left: "82%", top: "16%", delay: 0.7 },
  { text: "♡", left: "88%", top: "72%", delay: 1.1 },
  { text: "✧", left: "13%", top: "78%", delay: 1.8 },
  { text: "♥", left: "70%", top: "90%", delay: 2.3 },
  { text: "✦", left: "28%", top: "7%", delay: 2.8 },
  { text: "♡", left: "44%", top: "86%", delay: 3.2 },
  { text: "♥", left: "94%", top: "42%", delay: 3.6 },
  { text: "✧", left: "4%", top: "48%", delay: 4.1 },
  { text: "♡", left: "61%", top: "12%", delay: 4.5 },
];

export function FloatingDecor() {
  const reduceMotion = useReducedMotion();

  return (
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_16%,rgba(255,214,232,0.9),transparent_28%),radial-gradient(circle_at_84%_20%,rgba(185,228,255,0.75),transparent_24%),radial-gradient(circle_at_52%_92%,rgba(199,166,255,0.36),transparent_30%),linear-gradient(120deg,rgba(255,247,251,0.3),rgba(255,214,232,0.32),rgba(185,228,255,0.22),rgba(255,243,214,0.25))] bg-[length:180%_180%] animate-[gradient-drift_18s_ease-in-out_infinite]" />
      {decor.map((item) => (
        <motion.span
          key={`${item.text}-${item.left}`}
          className="absolute text-2xl font-black text-[#ff7aaa]/35"
          style={{ left: item.left, top: item.top }}
          animate={
            reduceMotion
              ? undefined
              : { y: [0, -14, 0], rotate: [-6, 8, -6], opacity: [0.35, 0.65, 0.35] }
          }
          transition={{
            duration: 5,
            delay: item.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {item.text}
        </motion.span>
      ))}
    </div>
  );
}
