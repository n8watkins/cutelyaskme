# HANDOFF — Orchestrator Playbook (Batch 6 onward)

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
  an `ca:` key (existing: `ca:mapZoomMode`), read post-mount (hydration), and
  get absorbed by the `/settings` page in Batch 8.
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
| `lib/itinerary.ts` | Gemini itinerary generation (used by plan PATCH + create) |
| `src/app/api/plans/[id]/route.ts` | PATCH: saves venues/waypoints/order, regenerates itinerary |
| `src/app/api/places/route.ts` (+ `[id]/route.ts`) | Yelp search (+ details/hours/reviews), `place_cache`d |
| `src/app/api/natural-places/route.ts` | Overpass natural spots (UA + mirrors + no-fail-caching) |
| `src/app/api/geocode/route.ts` | Nominatim forward/reverse, cached |
| `src/app/plan/[id]/page.tsx` | Plan page (server): renders itinerary timeline + tips, hosts `SenderPlanningView` for the owner |
| `lib/db/schema.ts` | All tables. Recent: `saved_addresses.kind`, `api_usage` |

## Batch 6 — what to build (specs: PLANNER_V2.md D2, D3, E1, E2, E3)

Suggested sub-agent split (3 tasks, run in this order — D3 and E1/E2 are
independent; E3 depends on D3's leg data for travel buffers):

1. **Task A — D3 travel times (OSRM):** new `src/app/api/route/route.ts`
   (OSRM `router.project-osrm.org`, driving; walking too for legs < 0.8 mi),
   cache by rounded coords (4 decimals) in `place_cache` 30-day TTL, haversine
   ×1.3 @ 28 mph fallback flagged "~estimate". Timeline rows in
   `SenderPlanningView` show "🚗 12 min · 4.3 mi" between stops with a
   drive/walk toggle on short legs; chosen mode persists per leg (extend the
   plan PATCH body — a `legModes` JSON column on `date_plans` via migration is
   acceptable). Track usage as service `osrm`.
2. **Task B — D2 sunset-aware ordering + E1/E2 itinerary integrity:** new
   `lib/schedule.ts` (`suggestOrder(stops, durations, sun)`) + tests; inline
   suggestion banner with one-tap reorder when a sun-sensitive stop lands
   outside its window (reuse `lib/sun.ts` SUN_SENSITIVE). In
   `lib/itinerary.ts`: prompt must say "use EXACTLY these stops, in this
   order — do not add/remove/rename venues"; validate the response (drop
   hallucinated entries, fall back to the deterministic timeline if counts
   mismatch); tips constrained to the real stops, max 3, box renamed "Tips
   for tonight ✨" (`src/app/plan/[id]/page.tsx:~255`).
3. **Task C — E3 one calendar button:** single "Add to calendar" control on
   the planner timeline (and plan page if it has its own), mode from
   localStorage `ca:calendarMode` (`"single"` default | `"per-stop"`):
   single → one GCal link / one-VEVENT .ics spanning the whole window with
   full itinerary text; per-stop → .ics with N VEVENTs (current `downloadICS`
   already does this) and an expandable ordered list of N pre-filled GCal
   links. Remove the per-stop "Add to Google Calendar" links from
   `TimelineRow`. Include travel legs in descriptions once Task A lands.

Acceptance criteria for each are in PLANNER_V2.md — quote them to sub-agents.

## After Batch 6

Batch 7 (F1–F5) needs a `dateEnd` notion (selected date + last stop end) —
Task A's timeline data feeds it. Batch 8 builds `/settings` and absorbs
`ca:mapZoomMode`, `ca:calendarMode`, and the usage meter. Batch 9 is the
animated keepsake card (music files → `public/audio/`, CC0 romantic loops).

## Launch status (separate track, user-driven)

`docs/LAUNCH.md` has the 3 manual steps (cutelyask.me DNS → Vercel, Resend
domain verify, Clerk production instance). Not blocking feature work.
