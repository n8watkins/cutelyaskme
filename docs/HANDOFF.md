# HANDOFF — Orchestrator Playbook (Batch 7 onward)

You are picking up an in-flight roadmap with **zero prior context**. This file +
[`PLANNER_V2.md`](PLANNER_V2.md) contain everything you need. Read both fully
before touching code. All product decisions are already made — **do not re-ask
the user anything answered in PLANNER_V2.md** (decisions table at top, specs
marked "decided", and the resolved-questions section).

## What this project is

A date-planning app ("CutelyAsk", future domain cutelyask.me): the sender
invites someone via email link (no login needed for the recipient), the
recipient picks activities/food/vibe through a cute wizard, then the sender
plans concrete venues on a map (`/plan/[id]`), confirms, and both review the
date afterward (verdicts, memory poem, photos).

**Stack:** Next.js 16 (App Router — it has breaking changes vs. your training
data; check `node_modules/next/dist/docs/` when unsure, per `AGENTS.md`),
React 19, TypeScript, Tailwind v4, Clerk auth (test keys), Turso (libSQL) +
Drizzle, Resend email, Gemini (`gemini-3.1-flash-lite`), Yelp Fusion,
Overpass/OSM, Nominatim, Leaflet, Cloudinary, web-push, suncalc, Vitest.

**Deployed:** https://date-planner-mini-site.vercel.app (stable alias).
`git push` does NOT auto-deploy — deploy explicitly (below).

## State of the roadmap

Batches 1–6 of `PLANNER_V2.md` are shipped + deployed (status table at the
bottom of that file, with commit hashes). **Batch 7 is next**: F1–F5 post-date
lifecycle. Then Batch 8 (Settings), Batch 9 (keepsake card). Batch 7's
`dateEnd` notion can build on Batch 6's leg data (`lib/route-legs.ts`,
`legByDestination`/`chosenLeg` in `SenderPlanningView`) plus stop durations.

## Orchestrator loop (per batch)

1. Read the batch's specs in PLANNER_V2.md. Each item has root cause, files,
   and acceptance criteria.
2. Split into sub-agent tasks (suggested split for Batch 6 below). Give each
   sub-agent: the spec text, the file map below, the conventions section, and
   the acceptance criteria. Sub-agents should NOT commit — they return diffs;
   you verify and commit.
3. Verify after each task: `npx tsc --noEmit && npx eslint <changed files> &&
   npm test && npx next build` — all four must pass.
4. Commit per coherent unit (style below), push to `origin main`.
5. Deploy: `npx vercel deploy --prod --yes`, then poll
   `npx vercel ls --prod` until the new deployment shows `● Ready`.
6. Report to the user what shipped, what was verified, what's next.

## Conventions & gotchas (hard-won — respect these)

- **Commits:** one per batch/coherent unit, imperative summary, body lists
  what+why, end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
  Run `git status --short` first; never commit `.env.local` (gitignored — all
  secrets live there and on Vercel).
- **DB migrations:** no drizzle-kit flow. Pattern: edit `lib/db/schema.ts`,
  then write a temp `migrate-tmp.mjs` in the repo root using
  `@libsql/client` + raw SQL (`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD
  COLUMN`), run `npx dotenv -e .env.local -- node migrate-tmp.mjs`, verify the
  output, delete the script. (Scripts must live in the repo root, not /tmp —
  module resolution.)
- **Lint rules that have bitten us** (eslint will catch, but write it right):
  no synchronous `setState` in a `useEffect` body (wrap in
  `Promise.resolve().then(...)` or do it in an async callback); no ref
  reads/writes during render (move to effects); escape ALL interpolations in
  Leaflet `bindPopup` HTML via `htmlEscape` from `@/lib/html`.
- **Gemini:** model `gemini-3.1-flash-lite` via raw fetch, header
  `x-goog-api-key`. `generationConfig.thinkingConfig.thinkingBudget: 0` is
  REQUIRED — without it thinking eats the token budget and truncates output.
- **Overpass:** always send a `User-Agent`; endpoints list with mirror
  fallback already in `natural-places/route.ts`; NEVER cache a failed/empty
  fetch result.
- **Yelp:** `venue.id` is the Yelp business id. OSM venues have ids `osm-*`;
  hand-dropped pins have `source: "custom"` + id `custom-*`. Reviews endpoint
  is paid-tier (404s) — code degrades gracefully; don't "fix" it.
- **API frugality (user cares a lot):** never fetch venues eagerly — searches
  are explicit per-stop actions; track outbound calls via
  `trackApiUsage(service)` from `@/lib/api-usage` (cache hits don't count).
- **Settings-before-Settings-page:** user preferences go in localStorage with
  an `ca:` key (existing: `ca:mapZoomMode`, `ca:calendarMode`), read post-mount
  (hydration), and get absorbed by the `/settings` page in Batch 8.
- **OSRM (Batch 6):** public demo server, no key. Its `foot` profile serves
  car-speed data, so `/api/route` runs walks through `plausibleWalk`
  (`lib/route-legs.ts`) and substitutes a 3 mph estimate when implausible —
  don't "fix" that. Cache key `osrm:<rounded coords>` in `place_cache` (30 d);
  never cache a failed fetch. Usage tracked as service `osrm`.
- **Leg modes:** `date_plans.leg_modes` (TEXT JSON, migration applied) maps
  leg key `"fromId→toId"` → `"drive" | "walk"`; node ids are `"start"`,
  `"pickup"`, and stop keys (incl. `__entree__`). In `SenderPlanningView`,
  `legByDestination` / `chosenLeg(destId)` expose per-leg `{ info: LegInfo }`
  with `durationSec`/`distanceMeters` — reuse for `dateEnd` math (F1).
- **Itinerary is deterministic (E1):** the timeline is always built from
  stops+durations (`deterministicTimeline` in `lib/itinerary.ts`); Gemini only
  contributes validated per-stop `note`s and ≤3 validated `tips`. Never let a
  change reintroduce free-form Gemini timelines.
- **Pure logic → `lib/*.ts` + a Vitest file** (`lib/foo.test.ts`, run
  `npm test`). Existing examples: `lib/datetime`, `lib/calendar`, `lib/sun`,
  `lib/geo`, `lib/hours`, `lib/html`, `lib/venues`.
- **Auth in API routes:** `const { userId } = await auth()` from
  `@clerk/nextjs/server`; route params are a Promise (`{ params }: { params:
  Promise<{ id: string }> }` → `await params`).

## File map (planner core)

| File | What it is |
|---|---|
| `components/sender/SenderPlanningView.tsx` | The whole sender planner (~1500 lines): stops, search, timeline, sun strip, waypoints, save/notify. `StopCard`, `VenueCard`, `WaypointPicker`, `SunStrip`, `BannerItem` live here |
| `components/sender/DateMap.tsx` | Leaflet map: numbered stop pins, candidate pins, waypoints, search pin+radius, click-to-pick (A5), wheel-zoom modes |
| `lib/venues.ts` | `Venue` type, activity→query maps, `NATURAL_PLACE_ACTIVITIES`, `NO_VENUE_ACTIVITIES`, durations, icons |
| `lib/calendar.ts` | `buildGCalLink`, `buildItineraryText`, `icsEscape` (tested) |
| `lib/datetime.ts` / `lib/sun.ts` / `lib/geo.ts` / `lib/hours.ts` | tested pure helpers (time parsing, sun warnings, haversine, Yelp hours/badges) |
| `lib/itinerary.ts` | Deterministic timeline + Gemini notes/tips with validation (tested; used by plan PATCH + create) |
| `lib/route-legs.ts` | OSRM leg types, cache keys, fallback estimates, `formatLeg` (tested) |
| `lib/schedule.ts` | `projectedStarts` + `suggestOrder` sunset-aware reordering (tested) |
| `src/app/api/route/route.ts` | OSRM travel times (driving + short-leg walking), `place_cache`d |
| `src/app/api/plans/[id]/route.ts` | PATCH: saves venues/waypoints/order/legModes, regenerates itinerary |
| `src/app/api/places/route.ts` (+ `[id]/route.ts`) | Yelp search (+ details/hours/reviews), `place_cache`d |
| `src/app/api/natural-places/route.ts` | Overpass natural spots (UA + mirrors + no-fail-caching) |
| `src/app/api/geocode/route.ts` | Nominatim forward/reverse, cached |
| `src/app/plan/[id]/page.tsx` | Plan page (server): renders itinerary timeline + tips ("Tips for tonight ✨"), hosts `SenderPlanningView` for the owner |
| `lib/db/schema.ts` | All tables. Recent: `saved_addresses.kind`, `api_usage`, `date_plans.leg_modes` |

### Files Batch 7 will touch

| File | What it is |
|---|---|
| `src/app/dashboard/page.tsx` | Sender dashboard (F3 modal, F5 reorder) |
| `components/VenueVerdicts.tsx` / `components/RatingWidget.tsx` / `components/MemoryKeepsake.tsx` | Post-date UI to gate on `dateEnd` (F1) and reuse in the F3 modal |
| `src/app/api/verdicts/route.ts` / `src/app/api/memories/route.ts` | POST routes to gate server-side on `dateEnd` (F1) |
| `lib/email.ts` / `lib/push.ts` | Resend email + web-push helpers — reuse for F4 cancel notify |
| `components/SavedAddresses.tsx` | Address book — F5 removes it from the dashboard bottom (parks it until Batch 8 Settings absorbs it) |

## Batch 7 — what to build (specs: PLANNER_V2.md F1–F5)

Everything hinges on a shared **`dateEnd`** notion: selected date + last stop's
end time, derived from the saved deterministic timeline (stop durations +
travel legs where available). Build it once as a pure tested helper (extend
`lib/schedule.ts` or a new `lib/date-end.ts`) usable server-side from the plan
row's saved itinerary/venues JSON.

Suggested sub-agent split (3 tasks, **run sequentially** — they share the plan
page and dashboard, and B/C both consume Task A's `dateEnd` helper):

1. **Task A — `dateEnd` + F1 gating + F2 reflection view:** pure `dateEnd`
   helper + tests; gate `VenueVerdicts`, `RatingWidget`, `MemoryKeepsake`
   rendering AND their POST routes on `now > dateEnd` (server-side too,
   "come back after your date 💞" before); past dates render a read-only
   reflection view on `/plan/[id]` (final itinerary, venues, map, rating,
   verdicts, memory, photos, optional "did you go anywhere else?" note
   appended to the memory) — no editing, no regeneration.
2. **Task B — F4 cancel a date:** `status` column or `canceledAt` on
   `date_plans` (migration via the pattern above); "Cancel this date" +
   confirm on the plan page; recipient link shows "this one's been called
   off 💔"; canceled plans leave Upcoming; **notify (decided):** if already
   shared/sent, email + push the other person (gentle copy, no guilt —
   reuse `lib/email.ts` / `lib/push.ts`).
3. **Task C — F3 "How did it go?" modal + F5 dashboard polish:** on dashboard
   load, if a confirmed plan's `dateEnd` passed with no rating/verdicts →
   one-time modal (star rating + swipe cards per visited venue reusing
   `VenueVerdicts` logic → "write your keepsake →" link); store `promptedAt`
   or local flag + server check so it never re-prompts per plan. Then F5:
   reorder dashboard to (1) prompt/next-date hero, (2) Upcoming, (3) Map +
   Stats, (4) Past dates, (5) Your Places; address book out of the bottom;
   consistent card paddings.

Acceptance criteria for each are in PLANNER_V2.md — quote them to sub-agents.

## After Batch 7

Batch 8 builds `/settings` (+ `user_settings` table) and absorbs
`ca:mapZoomMode`, `ca:calendarMode`, the address book, radius defaults, and
the usage meter (specs B4 + WP-H + C7's meter surface). Batch 9 is the
animated keepsake card (music files → `public/audio/`, CC0 romantic loops;
spec G1).

## Launch status (separate track, user-driven)

`docs/LAUNCH.md` has the 3 manual steps (cutelyask.me DNS → Vercel, Resend
domain verify, Clerk production instance). Not blocking feature work.
