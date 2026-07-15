"use client";

import { motion, useIsPresent } from "framer-motion";
import Image from "next/image";
import type { ReactNode } from "react";

type StepCardProps = {
  stickerSrc: string;
  stickerAlt: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function StepCard({
  stickerSrc,
  stickerAlt,
  eyebrow,
  title,
  subtitle,
  children,
}: StepCardProps) {
  const isPresent = useIsPresent();

  return (
    <motion.section
      key={title}
      aria-hidden={!isPresent}
      inert={!isPresent}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 360, damping: 32 }}
      className="w-full rounded-[32px] border border-white/80 bg-white/75 p-5 shadow-[0_24px_80px_rgba(255,122,170,0.24)] backdrop-blur-xl sm:p-7"
    >
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <Image
          src={stickerSrc}
          alt={stickerAlt}
          width={128}
          height={128}
          priority
          unoptimized
          className="mb-4 h-28 w-28 object-contain drop-shadow-[0_14px_22px_rgba(255,122,170,0.22)] sm:h-32 sm:w-32"
        />
        {eyebrow ? (
          <p className="mb-2 text-sm font-black uppercase tracking-[0.18em] text-[#8a6a78]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-balance text-4xl font-black leading-[1.04] text-[#3a2530] sm:text-5xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-3 max-w-sm text-pretty text-base font-semibold leading-7 text-[#8a6a78] sm:text-lg">
            {subtitle}
          </p>
        ) : null}
        <div className="mt-6 w-full">{children}</div>
      </div>
    </motion.section>
  );
}
