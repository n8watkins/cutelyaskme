import Link from "next/link";
import { PrototypeBar } from "@/components/proposal/ui";

const screens = [
  { href: "/proposal/home", title: "1. Home", body: "A real landing page: the ask as the hero, three steps, one action." },
  { href: "/proposal/dashboard", title: "2. Your dates", body: "One card per date with the shared thread and one next action." },
  { href: "/proposal/dashboard?empty=1", title: "2b. Your dates, empty", body: "The first thing a new sender sees." },
  { href: "/proposal/plan", title: "3. Guided planner", body: "One stop at a time with suggestions, a share bar that fills in, power tools tucked away." },
  { href: "/proposal/their-plan?state=waiting", title: "4a. Their plan, waiting", body: "What the person invited sees while the sender picks spots." },
  { href: "/proposal/their-plan", title: "4b. Their plan, shared", body: "Map, addresses, directions, calendar and the dress vibe." },
  { href: "/proposal/their-plan?state=surprise", title: "4c. Their plan, surprise", body: "Only when the sender chose to keep it a surprise." },
];

export default function ProposalIndex() {
  return (
    <>
      <PrototypeBar />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-black">UX upgrade prototype</h1>
        <p className="mt-2 text-muted">
          Clickable mock-ups for the November 2026 proposal. Nothing here talks to a server.
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {screens.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="block h-full rounded-[24px] border-2 border-petal bg-white p-5 transition hover:border-pink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-petal"
              >
                <span className="block font-black">{s.title}</span>
                <span className="mt-1 block text-sm text-muted">{s.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
