"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type OptionCardProps = {
  title: string;
  subtitle?: string;
  icon?: string;
  selected: boolean;
  onClick: () => void;
  multi?: boolean;
  special?: boolean;
  disabled?: boolean;
};

export function OptionCard({
  title,
  subtitle,
  icon,
  selected,
  onClick,
  multi = false,
  special = false,
  disabled = false,
}: OptionCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "relative min-h-16 overflow-hidden rounded-[22px] border-2 bg-white/85 p-4 text-left shadow-sm outline-none transition focus-visible:ring-4 focus-visible:ring-[#ffd6e8] disabled:cursor-not-allowed disabled:opacity-55",
        selected
          ? "border-[#ff7aaa] shadow-[0_14px_30px_rgba(255,122,170,0.22)]"
          : special
            ? "border-[#c7a6ff] bg-[linear-gradient(135deg,#fff,#fff3d6_45%,#e7d9ff)] hover:border-[#ff7aaa]"
            : "border-[#ffd6e8]/80 hover:border-[#ffb6d5]",
      )}
      aria-pressed={selected}
    >
      {special ? (
        <span
          aria-hidden
          className="absolute right-2 top-2 h-12 w-12 rounded-full bg-[#c7a6ff]/20 blur-xl"
        />
      ) : null}
      <span className="flex items-start gap-3 pr-8">
        {icon ? (
          <span
            aria-hidden
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#fff7fb] text-2xl shadow-inner"
          >
            {icon}
          </span>
        ) : null}
        <span className="min-w-0">
          <span className="block text-lg font-black leading-tight text-[#3a2530]">
            {title}
          </span>
          {subtitle ? (
            <span className="mt-1 block text-sm font-bold leading-5 text-[#8a6a78]">
              {subtitle}
            </span>
          ) : null}
        </span>
      </span>
      <span
        className={cn(
          "absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full border text-sm font-black",
          selected
            ? "border-[#ff7aaa] bg-[#ff7aaa] text-white"
            : "border-[#ffd6e8] bg-[#fff7fb] text-transparent",
        )}
        aria-hidden
      >
        {multi ? "✓" : "♥"}
      </span>
    </motion.button>
  );
}
