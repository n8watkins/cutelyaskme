import Link from "next/link";
import {
  Card,
  DateThread,
  Eyebrow,
  MapPlaceholder,
  PrimaryLink,
  PrototypeBar,
  SecondaryLink,
} from "@/components/proposal/ui";

const PICKS = [
  { icon: "📅", label: "Day", value: "Saturday, Nov 7" },
  { icon: "🕰️", label: "Time", value: "6:30 PM" },
  { icon: "💌", label: "Fun stuff", value: "Bookstore + Photo booth" },
  { icon: "🍕", label: "Food", value: "Pizza" },
  { icon: "🧢", label: "Your vibe", value: "Keep it casual" },
];

const STOPS = [
  { time: "6:30 PM", icon: "📚", title: "Bookstore at Vroman's", address: "695 E Colorado Blvd, Pasadena", note: "Pick out a book for each other." },
  { time: "7:30 PM", icon: "📸", title: "Photo booth at Magic Photo Booth", address: "41 S Raymond Ave, Pasadena", note: "Silly faces strongly encouraged." },
  { time: "8:00 PM", icon: "🍕", title: "Pizza at Pie Life", address: "99 E Green St, Pasadena", note: "Split a pie and argue about the crust." },
];

type State = "waiting" | "shared" | "surprise";

function PicksList() {
  return (
    <dl className="grid gap-3">
      {PICKS.map((p) => (
        <div key={p.label} className="flex items-center gap-3">
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blush text-xl">
            {p.icon}
          </span>
          <div>
            <dt className="text-xs font-black uppercase tracking-[0.14em] text-muted">{p.label}</dt>
            <dd className="font-black">{p.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

export default async function TheirPlan({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const raw = (await searchParams).state;
  const state: State = raw === "waiting" || raw === "surprise" ? raw : "shared";

  const bar = (
    <PrototypeBar
      links={[
        { href: "/proposal/their-plan?state=waiting", label: "Waiting" },
        { href: "/proposal/their-plan", label: "Shared" },
        { href: "/proposal/their-plan?state=surprise", label: "Surprise" },
        { href: "/proposal/plan", label: "Sender planner" },
      ]}
    />
  );

  if (state !== "shared") {
    const waiting = state === "waiting";
    return (
      <>
        {bar}
        <main className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:items-start lg:py-14">
          <div className="text-center lg:pt-6 lg:text-left">
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG sticker; next/image adds an inline style the CSP blocks */}
            <img
              src={waiting ? "/assets/heart-clock.svg" : "/assets/sticker-burst.svg"}
              alt=""
              width={120}
              height={120}
              className="mx-auto h-24 w-24 lg:mx-0"
            />
            <Eyebrow className="mt-4">{waiting ? "You said yes" : "It's a surprise"}</Eyebrow>
            <h1 className="mt-2 text-balance text-4xl font-black leading-tight">
              {waiting ? "Nate is picking the spots" : "Nate planned a surprise"}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-lg text-muted lg:mx-0">
              {waiting
                ? "You'll see the full plan here as soon as it's ready. Here's what you picked."
                : "Just bring yourself and your vibe. The full plan unlocks at 6:30 PM on Saturday."}
            </p>
            <div className="mx-auto mt-6 max-w-md rounded-[20px] bg-white/80 p-3 ring-2 ring-petal lg:mx-0">
              <DateThread current={waiting ? "Picked" : "Shared"} />
            </div>
          </div>

          <div className="space-y-4">
            <Card>
              <h2 className="mb-4 font-black">{waiting ? "Your picks" : "What to know"}</h2>
              {waiting ? (
                <PicksList />
              ) : (
                <dl className="grid gap-3">
                  {PICKS.filter((p) => ["Day", "Time", "Your vibe"].includes(p.label)).map((p) => (
                    <div key={p.label} className="flex items-center gap-3">
                      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blush text-xl">
                        {p.icon}
                      </span>
                      <div>
                        <dt className="text-xs font-black uppercase tracking-[0.14em] text-muted">{p.label}</dt>
                        <dd className="font-black">{p.value}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
              )}
            </Card>
            {waiting ? (
              <Card className="border-lilac bg-mist">
                <h2 className="font-black">Want a heads-up?</h2>
                <p className="mt-1 text-sm text-muted">We&apos;ll send one email when the plan is ready. Nothing else.</p>
                <form className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <label htmlFor="notify-email" className="sr-only">Your email</label>
                  <input
                    id="notify-email"
                    type="email"
                    placeholder="you@email.com"
                    className="min-h-12 flex-1 rounded-full border-2 border-lilac bg-white px-4 font-bold placeholder:text-muted"
                  />
                  <button type="button" className="min-h-12 rounded-full bg-lavender px-5 font-black text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lilac">
                    Notify me
                  </button>
                </form>
              </Card>
            ) : (
              <SecondaryLink href="/proposal/their-plan" className="w-full">
                Add to my calendar
              </SecondaryLink>
            )}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {bar}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="text-center lg:text-left">
          <Eyebrow>Your date with Nate</Eyebrow>
          <h1 className="mt-2 text-balance text-4xl font-black leading-tight sm:text-5xl">
            A Romantic Saturday in Old Pasadena
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-muted lg:mx-0">
            Books, a silly photo strip and the perfect slice. Saturday, Nov 7 at 6:30 PM.
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <PrimaryLink href="/proposal/their-plan" className="sm:w-auto">
            <span aria-hidden>📅</span> Add to calendar
          </PrimaryLink>
          <SecondaryLink href="/proposal/their-plan" className="sm:w-auto">
            <span aria-hidden>🧭</span> Directions for the night
          </SecondaryLink>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <ol className="space-y-3" aria-label="The stops">
              {STOPS.map((stop, i) => (
                <Card as="li" key={stop.title} className="flex gap-4">
                  <div className="flex w-16 shrink-0 flex-col items-center">
                    <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-pink-strong text-sm font-black text-white">
                      {i + 1}
                    </span>
                    <span className="mt-1.5 text-xs font-black text-muted">{stop.time}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-black">
                      <span aria-hidden>{stop.icon}</span> {stop.title}
                    </h2>
                    <p className="mt-0.5 text-sm text-muted">{stop.address}</p>
                    <p className="mt-1 text-sm">{stop.note}</p>
                    <Link
                      href="/proposal/their-plan"
                      className="mt-2 inline-flex min-h-11 items-center rounded-full text-sm font-black text-lavender underline underline-offset-4"
                      aria-label={`Directions to stop ${i + 1}`}
                    >
                      Directions
                    </Link>
                  </div>
                </Card>
              ))}
            </ol>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start" aria-label="Map and details">
            <div className="aspect-[19/12] overflow-hidden rounded-[24px] border-2 border-petal">
              <MapPlaceholder pins={3} label="Map of the three stops" />
            </div>
            <Card className="flex items-center gap-3">
              <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blush text-2xl">
                🧢
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">What to wear</p>
                <p className="font-black">Keep it casual, like you picked</p>
              </div>
            </Card>
            <Card className="bg-blush">
              <h2 className="font-black">Tips for the night ✨</h2>
              <ul className="mt-2 grid gap-1.5 text-sm text-muted">
                <li>Street parking on Green St is easiest after 6 PM.</li>
                <li>The photo booth takes cards and cash.</li>
              </ul>
            </Card>
            <div className="rounded-[20px] bg-white/80 p-3 ring-2 ring-petal">
              <DateThread current="Shared" />
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
