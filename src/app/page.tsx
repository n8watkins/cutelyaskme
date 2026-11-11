import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { HeroAsk } from "@/components/landing/HeroAsk";
import { BUILDER_URL, DEMO_ASK_PATH, PORTFOLIO_URL, WAITLIST_URL } from "@/lib/landing";

export const metadata: Metadata = {
  title: "Cutely Ask Me: ask them cutely, plan it for real",
  description:
    "Send a cute invite with a No button that runs away. They pick the vibe, you plan the real spots, and you both keep the memory.",
};

const steps = [
  {
    sticker: "/assets/heart-envelope.svg",
    title: "You ask",
    body: "A personal link with their name on it. No app to install, and the No button runs away.",
  },
  {
    sticker: "/assets/calendar-heart.svg",
    title: "They pick",
    body: "The day, the time, two activities, the food and the dress vibe, in a few cute taps.",
  },
  {
    sticker: "/assets/food-tray.svg",
    title: "You plan",
    body: "Real places on a map with travel times and a calendar invite. Share it, or keep it a surprise.",
  },
];

const differences = [
  {
    title: "Ask pages stop at yes",
    body: "Cute, then nothing. You still have to work out when, where and what to wear in a group chat.",
  },
  {
    title: "Planners are single-player",
    body: "They plan for you, not with them. The person you asked never gets a say.",
  },
  {
    title: "This is the handoff",
    body: "They say yes and pick the vibe, you turn it into a real plan, and you both see the same date.",
    highlight: true,
  },
];

const primaryCta =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-pink-strong px-7 text-lg font-black text-white shadow-[0_10px_24px_rgba(201,58,115,0.28)] outline-none transition hover:brightness-110 focus-visible:ring-4 focus-visible:ring-petal";
const secondaryCta =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-full border-2 border-petal bg-white px-7 text-lg font-black text-ink outline-none transition hover:bg-blush focus-visible:ring-4 focus-visible:ring-petal";

function Ctas({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row ${className}`}>
      <a href={WAITLIST_URL} className={primaryCta}>
        Join the waitlist
      </a>
      <Link href={DEMO_ASK_PATH} className={secondaryCta}>
        Try the demo ask
        <span className="rounded-full bg-lilac px-2 py-0.5 text-xs font-black text-lavender">Demo</span>
      </Link>
    </div>
  );
}

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="relative isolate overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[52rem] bg-[radial-gradient(ellipse_at_85%_10%,rgba(231,217,255,0.75),transparent_55%),radial-gradient(ellipse_at_5%_40%,rgba(255,214,232,0.7),transparent_50%)]"
      />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-2 text-lg font-black text-ink">
          <span aria-hidden>💌</span> Cutely Ask Me
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm font-black">
          <a href="#how" className="hidden min-h-11 items-center rounded-full px-3 text-muted hover:text-ink sm:inline-flex">
            How it works
          </a>
          <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-full px-3 text-muted hover:text-ink">
            Sign in
          </Link>
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:gap-16 lg:pb-24 lg:pt-14">
          <div className="text-center lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border-2 border-petal bg-white/80 px-3 py-1 text-sm font-black text-muted">
              <span aria-hidden className="h-2 w-2 rounded-full bg-pink" />
              For first asks and date nights
            </p>
            <h1 className="mt-5 text-balance text-[2.75rem] font-black leading-[1.02] text-ink sm:text-6xl lg:text-[3.9rem]">
              Ask them cutely.
              <br />
              <span className="text-pink-strong">Plan it for real.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-lg font-semibold leading-relaxed text-muted lg:mx-0">
              Send a cute invite with a No button that runs away. They pick the vibe, you plan the
              real spots, and you both keep the memory.
            </p>
            <Ctas className="mt-8 justify-center lg:justify-start" />
            <p className="mt-4 text-sm font-bold text-muted">
              The demo opens a sample invite. Nothing is sent to anyone.
            </p>
          </div>
          <HeroAsk />
        </section>

        <section id="how" aria-labelledby="how-title" className="scroll-mt-6 border-y border-petal bg-white/70 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-center text-sm font-black text-pink-strong">How it works</p>
            <h2 id="how-title" className="mt-2 text-balance text-center text-3xl font-black text-ink sm:text-4xl">
              One date, told from both sides
            </h2>
            <ol className="mt-12 grid gap-4 md:grid-cols-3">
              {steps.map((step, i) => (
                <li
                  key={step.title}
                  className="rounded-[28px] border-2 border-petal bg-white p-6 text-center shadow-[0_8px_28px_rgba(255,122,170,0.10)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- static SVG sticker; next/image adds an inline style the CSP blocks */}
                  <img src={step.sticker} alt="" width={88} height={88} className="mx-auto h-20 w-20" />
                  <p className="mt-3 text-sm font-black text-pink-strong">Step {i + 1}</p>
                  <h3 className="mt-1 text-2xl font-black text-ink">{step.title}</h3>
                  <p className="mt-2 font-semibold leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="keep-title" className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div className="text-center lg:text-left">
            <p className="text-sm font-black text-pink-strong">After the date</p>
            <h2 id="keep-title" className="mt-2 text-balance text-3xl font-black text-ink sm:text-4xl">
              Keep the memory
            </h2>
            <p className="mx-auto mt-4 max-w-md text-pretty text-lg font-semibold leading-relaxed text-muted lg:mx-0">
              After the date, rate the night and get a little poem and photo card to keep.
            </p>
          </div>
          <figure className="mx-auto w-full max-w-sm rotate-1 rounded-[28px] border-2 border-dashed border-petal bg-white p-6 text-center shadow-[0_18px_40px_rgba(255,122,170,0.18)]">
            <p className="text-sm font-black text-muted">A keepsake from</p>
            <p className="mt-2 font-serif text-2xl leading-tight text-ink">A Romantic Saturday in Old Pasadena</p>
            <p className="mt-1 text-sm font-black text-pink-strong">Saturday, Nov 7 · ★★★★★</p>
            <blockquote className="mt-5 space-y-1 text-left font-serif text-lg leading-snug text-ink">
              <p>The bookstore aisles held ghosts of us,</p>
              <p>I laughed until my ribs felt sore,</p>
              <p>then pizza, thin and warm, and stars,</p>
              <p>and wanting nothing, nothing more.</p>
            </blockquote>
          </figure>
        </section>

        <section aria-labelledby="why-title" className="border-t border-petal bg-white/70 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-center text-sm font-black text-pink-strong">Why it is different</p>
            <h2 id="why-title" className="mt-2 text-balance text-center text-3xl font-black text-ink sm:text-4xl">
              The ask and the plan, finally in one place
            </h2>
            <ul className="mt-12 grid gap-4 md:grid-cols-3">
              {differences.map((item) => (
                <li
                  key={item.title}
                  className={
                    item.highlight
                      ? "rounded-[28px] bg-pink-strong p-6 text-white shadow-[0_18px_40px_rgba(201,58,115,0.25)]"
                      : "rounded-[28px] border-2 border-petal bg-white p-6"
                  }
                >
                  <h3 className={`text-xl font-black ${item.highlight ? "text-white" : "text-ink"}`}>{item.title}</h3>
                  <p className={`mt-2 font-semibold leading-relaxed ${item.highlight ? "text-white/90" : "text-muted"}`}>
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="cta-title" className="px-4 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-3xl rounded-[36px] bg-ink px-6 py-12 text-center text-white sm:px-12">
            <h2 id="cta-title" className="text-balance text-3xl font-black sm:text-4xl">
              Someone on your mind?
            </h2>
            <p className="mx-auto mt-3 max-w-md font-semibold text-white/80">
              Join the waitlist and hear when it opens. We only email you about launch.
            </p>
            <Ctas className="mt-8 justify-center" />
          </div>
        </section>
      </main>

      <footer className="border-t border-petal">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center text-sm font-semibold text-muted sm:flex-row sm:justify-between sm:px-6 sm:text-left">
          <p>
            A small project by{" "}
            <a href={BUILDER_URL} className="font-black text-ink underline-offset-4 hover:text-pink-strong hover:underline">
              n8builds.dev
            </a>
            {" · "}
            <a href={PORTFOLIO_URL} className="font-black text-ink underline-offset-4 hover:text-pink-strong hover:underline">
              Portfolio
            </a>
          </p>
          <p>We only email you about launch.</p>
        </div>
      </footer>
    </div>
  );
}
