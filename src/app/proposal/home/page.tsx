import Link from "next/link";
import { Card, Eyebrow, PrimaryLink, PrototypeBar, SecondaryLink } from "@/components/proposal/ui";
import { MiniAsk } from "./MiniAsk";

const steps = [
  {
    sticker: "/assets/heart-envelope.svg",
    title: "You ask",
    body: "Send a personal link. No app for them to install, and the No button runs away.",
  },
  {
    sticker: "/assets/calendar-heart.svg",
    title: "They pick the vibe",
    body: "Day, time, two fun things, food and what to wear. Six cute taps.",
  },
  {
    sticker: "/assets/food-tray.svg",
    title: "You plan it for real",
    body: "Real spots on a map with travel times. Share it, or keep it a surprise.",
  },
];

export default function ProposalHome() {
  return (
    <>
      <PrototypeBar />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/proposal/home" className="flex items-center gap-2 text-lg font-black">
          <span aria-hidden>💌</span> Cutely Ask Me
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm font-black">
          <a href="#how" className="hidden min-h-11 items-center rounded-full px-3 text-muted hover:text-ink sm:inline-flex">
            How it works
          </a>
          <Link href="/proposal/dashboard" className="inline-flex min-h-11 items-center rounded-full px-3 text-muted hover:text-ink">
            Sign in
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-14 pt-6 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24 lg:pt-12">
          <div className="text-center lg:text-left">
            <Eyebrow>For first asks and date nights</Eyebrow>
            <h1 className="mt-3 text-balance text-[2.6rem] font-black leading-[1.02] sm:text-6xl">
              Ask them cutely.
              <br />
              <span className="text-pink-strong">Plan it for real.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted lg:mx-0">
              Send a sweet invite with a No button that runs away. They pick the vibe, you plan
              the real spots, and you both keep the memory.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <PrimaryLink href="/proposal/dashboard?empty=1" size="lg" className="w-full sm:w-auto">
                Ask someone out
              </PrimaryLink>
              <SecondaryLink href="#demo" size="lg" className="w-full sm:w-auto">
                Try the demo ask
              </SecondaryLink>
            </div>
            <p className="mt-4 text-sm font-bold text-muted">Free. They never need an account.</p>
          </div>

          <div id="demo" className="mx-auto w-full max-w-md scroll-mt-20">
            <MiniAsk />
          </div>
        </section>

        <section id="how" aria-labelledby="how-title" className="scroll-mt-16 bg-white/70 py-14 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="how-title" className="text-center text-3xl font-black sm:text-4xl">
              How it works
            </h2>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {steps.map((step, i) => (
                <li key={step.title}>
                  <Card as="div" className="h-full text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static SVG sticker; next/image adds an inline style the CSP blocks */}
                    <img
                      src={step.sticker}
                      alt=""
                      width={88}
                      height={88}
                      className="mx-auto h-20 w-20"
                    />
                    <p className="mt-3 text-sm font-black text-pink-strong">Step {i + 1}</p>
                    <h3 className="mt-1 text-xl font-black">{step.title}</h3>
                    <p className="mt-2 text-muted">{step.body}</p>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="keep-title" className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div className="text-center lg:text-left">
            <h2 id="keep-title" className="text-3xl font-black sm:text-4xl">
              Then keep the memory
            </h2>
            <p className="mx-auto mt-4 max-w-md text-lg text-muted lg:mx-0">
              After the date you both rate the night, and your notes become a little poem on a
              card with your photos. Share it, or keep it just for you two.
            </p>
          </div>
          <figure className="mx-auto w-full max-w-sm rounded-[28px] border-2 border-dashed border-petal bg-white p-6 text-center shadow-[0_18px_40px_rgba(255,122,170,0.18)]">
            <Eyebrow>A keepsake from</Eyebrow>
            <p className="mt-2 font-serif text-2xl leading-tight">A Romantic Saturday in Old Pasadena</p>
            <p className="mt-1 text-sm font-black text-pink-strong">Saturday, Nov 7</p>
            <blockquote className="mt-5 space-y-1 text-left font-serif text-lg leading-snug text-ink">
              <p>The bookstore aisles held ghosts of us,</p>
              <p>I laughed until my ribs felt sore,</p>
              <p>then pizza, thin and warm, and stars,</p>
              <p>and wanting nothing, nothing more.</p>
            </blockquote>
          </figure>
        </section>

        <section className="px-4 pb-16 sm:px-6">
          <div className="mx-auto max-w-3xl rounded-[32px] bg-ink px-6 py-10 text-center text-white sm:px-10">
            <h2 className="text-3xl font-black">Someone on your mind?</h2>
            <p className="mx-auto mt-3 max-w-md text-white/80">It takes a minute to ask. They will remember it longer.</p>
            <PrimaryLink href="/proposal/dashboard?empty=1" size="lg" className="mt-6">
              Ask someone out
            </PrimaryLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-petal px-4 py-6 text-center text-sm text-muted">
        A small project by Nathan Watkins
      </footer>
    </>
  );
}
