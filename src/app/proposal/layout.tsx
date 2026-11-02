import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UX proposal prototype - Cutely Ask Me",
  robots: { index: false, follow: false },
};

// Static, clickable prototype for docs/UX_PLAN_2026-11.md. Mock data only:
// no auth, no database, no third-party APIs.
export default function ProposalLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh bg-blush text-ink">{children}</div>;
}
