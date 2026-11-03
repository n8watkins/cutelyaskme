import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isPrototypeEnabled } from "@/lib/prototype";

export const metadata: Metadata = {
  title: "UX proposal prototype - Cutely Ask Me",
  robots: { index: false, follow: false },
};

// Static, clickable prototype for docs/UX_PLAN_2026-11.md. Mock data only:
// no auth, no database, no third-party APIs.
export default function ProposalLayout({ children }: { children: React.ReactNode }) {
  // Second line of defense behind src/proxy.ts.
  if (!isPrototypeEnabled()) notFound();
  return <div className="min-h-svh bg-blush text-ink">{children}</div>;
}
