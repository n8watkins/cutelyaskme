"use client";

import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

export type HoverBubbleState = {
  text: string;
  x: number;
  y: number;
} | null;

type HoverBubbleProps = {
  bubble: HoverBubbleState;
};

export function HoverBubble({ bubble }: HoverBubbleProps) {
  const portalRoot = typeof document === "undefined" ? null : document.body;

  if (!portalRoot) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {bubble ? (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.94 }}
          className="pointer-events-none fixed z-50 w-52 rounded-[22px] border-2 border-[#ffd6e8] bg-white px-4 py-3 text-center text-sm font-black leading-tight text-[#8a6a78] shadow-[0_12px_28px_rgba(255,122,170,0.2)] after:absolute after:left-[-7px] after:top-1/2 after:h-3 after:w-3 after:-translate-y-1/2 after:rotate-45 after:border-b-2 after:border-l-2 after:border-[#ffd6e8] after:bg-white"
          style={{
            left: Math.max(12, Math.min(bubble.x + 56, window.innerWidth - 230)),
            top: Math.min(Math.max(18, bubble.y - 22), window.innerHeight - 112),
          }}
        >
          {bubble.text}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    portalRoot,
  );
}
