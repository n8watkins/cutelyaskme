# HANDOFF — Orchestrator Playbook (Batch 8 onward)

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

Batches 1–7 of `PLANNER_V2.md` are shipped + deployed (status table at the
bottom of that file, with commit hashes). **Batch 8 is next**: `/settings` +
`user_settings` (B4 + WP-H), absorbing `ca:mapZoomMode`, `ca:calendarMode`,
the parked address book (`components/SavedAddresses.tsx` — removed from the
dashboard in F5), radius defaults, and the usage meter. (The per-plan
`ca:reviewPrompted:<planId>` flags from F3 stay in localStorage — they're not
settings.) Then Batch 9 (keepsake card; F3's "write your
keepsake →" link currently points at `/plan/[id]` and should move to the G1
memory page). Batch 7 added `lib/date-end.ts` (`isDateOver`/`dateEndFromPlan`
from raw plan rows), `date_plans.canceled_at`, and `lib/review-prompt.ts` —
reuse, don't reinvent.

## Orchestrator loop (per batch)

1. Read the batch's specs in PLANNER_V2.md. Each item has root cause, files,
   and acceptance criteria.
2. Split into sub-agent tasks (suggested split for Batch 8 below). Give each
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
- **react-hooks/purity runs on SERVER components too:** `Date.now()` /
  `new Date()` inline in a component body is a lint error. Do now-comparisons
  inside lib helpers (`isDateOver` in `lib/date-end.ts`, `pickReviewPromptPlan`
  in `lib/review-prompt.ts`) and call those from the component.
- **Post-date lifecycle (Batch 7):** `isDateOver(plan)` from `lib/date-end`
  gates ratings/verdicts/memories — client AND server (the POST routes 403
  with "Come back after your date 💞"). `date_plans.canceled_at` freezes a
  plan — every per-plan write route (PATCH, notify, ratings, verdicts,
  memories, photos) rejects canceled plans with 409. `confirmedAt` is what
  marks a plan shared/sent (set by Share/Surprise; cancel only notifies when
  it's set). `/plan/[id]` has four render paths: canceled → called-off card;
  sender+over → read-only reflection view; sender+active → planner;
  recipient/shared view. F3's never-re-prompt = server check (existing
  rating/verdicts) + `ca:reviewPrompted:<planId>` localStorage flag.

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
| `src/app/plan/[id]/page.tsx` | Plan page (server): four render paths (canceled / sender reflection / sender planner / recipient), itinerary timeline + tips |
| `lib/db/schema.ts` | All tables. Recent: `saved_addresses.kind`, `api_usage`, `date_plans.leg_modes`, `date_plans.canceled_at` |
| `lib/date-end.ts` | `dateEnd`/`isDateOver`/`dateEndFromPlan` from raw plan rows (tested) — the post-date gate |
| `lib/review-prompt.ts` | F3 eligibility: `pickReviewPromptPlan`, `reviewPromptTitle` (tested) |
| `components/DateReviewModal.tsx` | F3 modal: stars → verdict swipe cards → keepsake link |
| `components/sender/CancelDateButton.tsx` + `src/app/api/plans/[id]/cancel/route.ts` | F4 cancel (idempotent, best-effort notify) |
| `src/app/dashboard/page.tsx` | Dashboard: F5 order (hero → Upcoming → invites → map+stats → Past → Places), hosts the F3 modal |

### Files Batch 8 will touch

| File | What it is |
|---|---|
| `src/app/settings/page.tsx` + `src/app/api/settings/route.ts` | NEW — the Settings page + its GET/PATCH API |
| `lib/db/schema.ts` | add `user_settings` (1 row per user; migration via the pattern above) |
| `components/SavedAddresses.tsx` | Address book — parked since F5 (not mounted anywhere); re-home it in `/settings` |
| `components/sender/SenderPlanningView.tsx` | Reads `ca:mapZoomMode` + `ca:calendarMode` post-mount and owns the radius slider (B3 default/bounds) — switch to settings |
| `components/sender/DateMap.tsx` | `wheelZoomMode` prop ("ctrl" \| "plain") fed from the zoom setting |
| `src/app/api/usage/route.ts` | Existing usage endpoint (`api_usage` table) — the C7 meter reads from here |

## Batch 8 — what to build (specs: PLANNER_V2.md B4 + WP-H, meter from C7)

Auth-gated `/settings` page + `user_settings` table (1 row per user, JSON or
columns) that becomes the home for:

- **Default search radius + bounds** (B3) — the planner slider's initial
  value/range. Accept: changing the default in Settings changes the planner's
  initial slider value.
- **Map wheel-zoom mode** (A2) — absorbs `ca:mapZoomMode` ("ctrl" | "plain").
- **Calendar export mode** (E3) — absorbs `ca:calendarMode` (one event |
  per stop).
- **Address book** — mount `SavedAddresses` here (it's been unmounted since F5).
- **Yelp usage meter** (C7) — "Yelp: N calls today" + free-tier reference;
  `api_usage` + `/api/usage` already exist. Accept: count increments after a
  search.
- Future hooks only (don't build): theme/style switcher, notification prefs.

Suggested split (2 tasks, sequential):

1. **Task A — table + API + page:** `user_settings` schema (sub-agent reports
   the SQL; orchestrator migrates), GET/PATCH `/api/settings`, `/settings` UI
   in the app's pink visual language (radius default/bounds, zoom mode,
   calendar mode, usage meter, address book), link to it from the dashboard
   header.
2. **Task B — wire the planner:** planner/map/calendar consume settings, with
   the old `ca:` localStorage values as a one-time fallback/migration so
   nobody's existing prefs reset; radius slider honors configured
   default + bounds.

Acceptance criteria are in PLANNER_V2.md (B4, C7) — quote them to sub-agents.

## After Batch 8

Batch 9 is the animated keepsake card (spec G1): `/plan/[id]/memory`, music
files → `public/audio/` (CC0 romantic loops), `date_memories` gains
`share_token` + `music_track`. Two existing links should then point there:
the F3 modal's "write your keepsake →" and the F2 reflection view (both
currently land on `/plan/[id]`).

## Launch status (separate track, user-driven)

`docs/LAUNCH.md` has the 3 manual steps (cutelyask.me DNS → Vercel, Resend
domain verify, Clerk production instance). Not blocking feature work.
