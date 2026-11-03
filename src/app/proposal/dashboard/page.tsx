import Link from "next/link";
import {
  Card,
  DateThread,
  Eyebrow,
  MapPlaceholder,
  PrimaryLink,
  PrototypeBar,
  SecondaryLink,
  type ThreadStep,
} from "@/components/proposal/ui";

type MockDate = {
  name: string;
  when: string;
  detail: string;
  step: ThreadStep;
  action: { label: string; href: string; primary: boolean };
  note: string;
};

const needsYou: MockDate[] = [
  {
    name: "Sam",
    when: "Sat, Nov 7 · 6:30 PM",
    detail: "Bookstore + Photo booth, then Pizza",
    step: "Picked",
    note: "Sam said yes and picked the vibe.",
    action: { label: "Pick the spots", href: "/proposal/plan", primary: true },
  },
  {
    name: "Riley",
    when: "Fri, Oct 30",
    detail: "Coffee + Gallery stroll, then Tacos",
    step: "Shared",
    note: "The date is over. How did it go?",
    action: { label: "Rate the night", href: "/proposal/dashboard", primary: true },
  },
];

const comingUp: MockDate[] = [
  {
    name: "Alex",
    when: "Sat, Nov 14 · 7:00 PM",
    detail: "Mini golf + Drinks, then Ramen",
    step: "Shared",
    note: "Shared Nov 1. Alex can see every stop.",
    action: { label: "Open plan", href: "/proposal/their-plan", primary: false },
  },
  {
    name: "Jordan",
    when: "Invite sent Nov 2",
    detail: "Near Silver Lake, CA",
    step: "Asked",
    note: "Waiting for Jordan to answer.",
    action: { label: "Copy link again", href: "/proposal/dashboard", primary: false },
  },
];

function DateCard({ date }: { date: MockDate }) {
  return (
    <Card as="li" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-black">Date with {date.name}</h3>
          <p className="mt-0.5 font-black text-pink-strong">{date.when}</p>
          <p className="mt-0.5 truncate text-sm text-muted">{date.detail}</p>
        </div>
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blush text-2xl">
          💌
        </span>
      </div>
      <DateThread current={date.step} size="sm" label={`Where the date with ${date.name} is`} />
      <div className="flex flex-col gap-3 border-t-2 border-blush pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-muted">{date.note}</p>
        {date.action.primary ? (
          <PrimaryLink href={date.action.href} size="sm" className="shrink-0">
            {date.action.label}
          </PrimaryLink>
        ) : (
          <SecondaryLink href={date.action.href} size="sm" className="shrink-0">
            {date.action.label}
          </SecondaryLink>
        )}
      </div>
    </Card>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${title}-h`} className="space-y-3">
      <h2 id={`${title}-h`} className="flex items-baseline gap-2 text-lg font-black">
        {title}
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-muted ring-2 ring-petal">{count}</span>
      </h2>
      <ul className="grid gap-3">{children}</ul>
    </section>
  );
}

export default async function ProposalDashboard({
  searchParams,
}: {
  searchParams: Promise<{ empty?: string }>;
}) {
  const empty = (await searchParams).empty === "1";

  return (
    <>
      <PrototypeBar
        links={[
          { href: "/proposal/home", label: "Home" },
          { href: "/proposal/dashboard", label: "Dashboard" },
          { href: "/proposal/dashboard?empty=1", label: "Dashboard, empty" },
          { href: "/proposal/plan", label: "Planner" },
          { href: "/proposal/their-plan", label: "Their plan" },
        ]}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="whitespace-nowrap text-2xl font-black sm:text-4xl">Your dates</h1>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/proposal/dashboard"
              aria-label="Settings"
              className="grid h-11 w-11 place-items-center rounded-full border-2 border-petal bg-white text-lg hover:bg-blush focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-petal"
            >
              <span aria-hidden>⚙️</span>
            </Link>
            {!empty && (
              <PrimaryLink href="/proposal/dashboard?empty=1" size="sm">
                <span aria-hidden>+</span> Ask someone
              </PrimaryLink>
            )}
          </div>
        </div>

        {empty ? (
          <Card className="mx-auto mt-10 max-w-xl py-10 text-center sm:py-12">
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG sticker; next/image adds an inline style the CSP blocks */}
            <img
              src="/assets/heart-envelope.svg"
              alt=""
              width={120}
              height={120}
              className="mx-auto h-28 w-28"
            />
            <h2 className="mt-4 text-2xl font-black">No dates yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-muted">
              Ask someone cute. They pick the vibe, you plan the spots, and every date shows up
              here.
            </p>
            <PrimaryLink href="/proposal/dashboard" size="lg" className="mt-6">
              Ask someone out
            </PrimaryLink>
            <p className="mt-4 text-sm font-bold text-muted">
              Not sure yet? <Link href="/proposal/home#demo" className="text-pink-strong underline underline-offset-4">See what they will see</Link>
            </p>
          </Card>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="space-y-8">
              <Section title="Needs you" count={needsYou.length}>
                {needsYou.map((d) => (
                  <DateCard key={d.name} date={d} />
                ))}
              </Section>
              <Section title="Coming up" count={comingUp.length}>
                {comingUp.map((d) => (
                  <DateCard key={d.name} date={d} />
                ))}
              </Section>
            </div>

            <aside className="space-y-4" aria-label="Your date history">
              <div className="flex items-start gap-3 rounded-[20px] border-2 border-lilac bg-mist p-4">
                <span aria-hidden className="text-xl">🔔</span>
                <div className="min-w-0 flex-1">
                  <p className="font-black">Get a ping when they answer</p>
                  <p className="text-sm text-muted">One tap, and you can turn it off anytime.</p>
                </div>
                <button type="button" className="min-h-11 shrink-0 rounded-full px-3 text-sm font-black text-lavender underline underline-offset-4">
                  Turn on
                </button>
              </div>
              <Card>
                <Eyebrow>Memories</Eyebrow>
                <div className="mt-3 aspect-[19/12] overflow-hidden rounded-[20px]">
                  <MapPlaceholder pins={3} label="Map of places from your past dates" />
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["4", "dates"],
                    ["9", "places"],
                    ["5", "loved"],
                  ].map(([n, l]) => (
                    <div key={l} className="flex flex-col-reverse rounded-2xl bg-blush py-3">
                      <dt className="text-xs font-black text-muted">{l}</dt>
                      <dd className="text-2xl font-black">{n}</dd>
                    </div>
                  ))}
                </dl>
                <Link href="/proposal/dashboard" className="mt-4 flex min-h-11 items-center justify-center rounded-full text-sm font-black text-pink-strong underline underline-offset-4">
                  See all memories
                </Link>
              </Card>
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
