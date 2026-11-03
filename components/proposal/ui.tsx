import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Building blocks for the UX proposal prototype (docs/UX_PLAN_2026-11.md).
// Styled only with the proposed tokens from globals.css, no inline styles,
// so the pages render the same under the production CSP.

export const THREAD_STEPS = ["Asked", "Picked", "Planned", "Shared", "Memory"] as const;
export type ThreadStep = (typeof THREAD_STEPS)[number];

/** The shared five-moment "date thread", identical on both sides. */
export function DateThread({
  current,
  size = "md",
  label = "Where this date is",
}: {
  current: ThreadStep;
  size?: "sm" | "md";
  label?: string;
}) {
  const index = THREAD_STEPS.indexOf(current);
  return (
    <ol aria-label={label} className="grid grid-cols-5 gap-1">
      {THREAD_STEPS.map((step, i) => {
        const done = i < index;
        const now = i === index;
        return (
          <li
            key={step}
            aria-current={now ? "step" : undefined}
            className="flex min-w-0 flex-col items-center gap-1.5"
          >
            <span className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : i <= index ? "bg-pink-strong" : "bg-petal"}`} />
              <span
                aria-hidden
                className={`grid shrink-0 place-items-center rounded-full font-black ${
                  size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs"
                } ${
                  done
                    ? "bg-pink-strong text-white"
                    : now
                      ? "bg-white text-pink-strong ring-[3px] ring-pink-strong"
                      : "bg-white text-muted ring-2 ring-petal"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={`h-0.5 flex-1 ${i === THREAD_STEPS.length - 1 ? "bg-transparent" : i < index ? "bg-pink-strong" : "bg-petal"}`} />
            </span>
            <span
              className={`truncate text-center font-black ${size === "sm" ? "text-[11px]" : "text-xs"} ${
                now ? "text-ink" : "text-muted"
              }`}
            >
              {step}
              {now ? <span className="sr-only"> (now)</span> : done ? <span className="sr-only"> (done)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-black transition outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50";
const sizes = {
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-12 px-6 text-base",
  lg: "min-h-14 px-7 text-lg",
};

export function primaryClass(size: keyof typeof sizes = "md") {
  return `${base} ${sizes[size]} bg-pink-strong text-white shadow-[0_10px_24px_rgba(201,58,115,0.28)] hover:brightness-110 focus-visible:ring-petal`;
}

export function secondaryClass(size: keyof typeof sizes = "md") {
  return `${base} ${sizes[size]} border-2 border-petal bg-white text-ink hover:bg-blush focus-visible:ring-petal`;
}

export function PrimaryLink({ size, className = "", ...props }: ComponentProps<typeof Link> & { size?: keyof typeof sizes }) {
  return <Link {...props} className={`${primaryClass(size)} ${className}`} />;
}

export function SecondaryLink({ size, className = "", ...props }: ComponentProps<typeof Link> & { size?: keyof typeof sizes }) {
  return <Link {...props} className={`${secondaryClass(size)} ${className}`} />;
}

export function Card({ children, className = "", as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "li" }) {
  return (
    <Tag className={`rounded-[24px] border-2 border-petal bg-white p-4 shadow-[0_8px_28px_rgba(255,122,170,0.10)] sm:p-5 ${className}`}>
      {children}
    </Tag>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-xs font-black uppercase tracking-[0.16em] text-muted ${className}`}>{children}</p>
  );
}

export function Chip({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border-2 border-petal bg-white px-3 text-sm font-black text-ink">
      <span aria-hidden>{icon}</span>
      {children}
    </span>
  );
}

/** A stylized map with numbered pins: the prototype calls no map API. */
export function MapPlaceholder({
  pins,
  className = "",
  label = "Map of the stops",
}: {
  pins: number;
  className?: string;
  label?: string;
}) {
  const spots = [
    { x: 92, y: 168 },
    { x: 196, y: 104 },
    { x: 292, y: 150 },
  ].slice(0, pins);
  return (
    <svg
      viewBox="0 0 380 240"
      role="img"
      aria-label={label}
      className={`block h-full w-full rounded-[20px] bg-[#fdf3f8] ${className}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="380" height="240" fill="#fdf3f8" />
      <path d="M0 60 H380 M0 132 H380 M0 204 H380 M70 0 V240 M170 0 V240 M260 0 V240 M340 0 V240" stroke="#f3e3ec" strokeWidth="10" />
      <path d="M0 96 C120 80 200 200 380 176" stroke="#e7d9ff" strokeWidth="14" fill="none" />
      <circle cx="306" cy="58" r="26" fill="#e3f4e6" />
      <circle cx="40" cy="214" r="18" fill="#e3f4e6" />
      {spots.length > 1 && (
        <polyline
          points={spots.map((s) => `${s.x},${s.y}`).join(" ")}
          fill="none"
          stroke="#c93a73"
          strokeWidth="3"
          strokeDasharray="6 6"
          strokeLinecap="round"
        />
      )}
      {spots.map((s, i) => (
        <g key={i}>
          <circle cx={s.x} cy={s.y} r="15" fill="#c93a73" stroke="#fff" strokeWidth="3" />
          <text x={s.x} y={s.y + 5} textAnchor="middle" fontSize="14" fontWeight="900" fill="#fff" fontFamily="inherit">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function PrototypeBar({ links }: { links?: { href: string; label: string }[] }) {
  const screens = links ?? [
    { href: "/proposal/home", label: "Home" },
    { href: "/proposal/dashboard", label: "Dashboard" },
    { href: "/proposal/plan", label: "Planner" },
    { href: "/proposal/their-plan", label: "Their plan" },
  ];
  return (
    <nav
      aria-label="Prototype screens"
      data-prototype-bar
      className="sticky top-0 z-40 border-b border-lilac bg-mist/95 px-4 py-2 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 overflow-x-auto text-xs font-black text-lavender">
        <Link href="/proposal" className="shrink-0 rounded-full bg-lavender px-2.5 py-1 text-white">
          Prototype
        </Link>
        {screens.map((s) => (
          <Link key={s.href} href={s.href} className="shrink-0 rounded-full px-2 py-1 underline-offset-4 hover:underline">
            {s.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
