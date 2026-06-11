# HANDOFF — Orchestrator Playbook (Batch 9 onward)

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

**All batches (1–9) of `PLANNER_V2.md` are shipped + deployed** (status table
at the bottom of that file, with commit hashes). Batch 9 (G1) added the
keepsake card: `/plan/[id]/memory` (`KeepsakeCard` client component — poem in
Playfair Display, photo cross-fade slideshow, CSS hearts, tap-to-play music),
`date_memories.share_token` (unique) + `music_track` (migration applied),
`lib/memory-music.ts` / `lib/memory-display.ts` / `lib/memory-share.ts` (all
tested), `PATCH /api/memories/share` (author-only share mint/revoke +
music_track persist), a logged-out `?share=<token>` path, three CC-BY loops in
`public/audio/` (attribution in `ATTRIBUTION.md` AND rendered on the card —
keep both), the `MemoryKeepsake` teaser, and the F2/F3 links repointed at the
memory page. Batch 8 added `user_settings` (1 row per user; migration
applied), `lib/settings.ts` (defaults/validation/`legacySettingsPatch`,
tested), `lib/user-settings.ts` (`getUserSettings` / `getUserSettingsState`),
GET/PATCH `/api/settings`, and the `/settings` page (radius default+bounds,
zoom mode, calendar mode, Yelp usage meter, re-homed address book). The
planner consumes settings via server props from `/plan/[id]`; legacy
`ca:mapZoomMode`/`ca:calendarMode` localStorage values migrate up once when no
settings row exists (the row itself is the migration flag). (The per-plan
`ca:reviewPrompted:<planId>` flags from F3 stay in localStorage — they're not
settings.) Batch 7 added `lib/date-end.ts` (`isDateOver`/`dateEndFromPlan`
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
- **Settings (Batch 8, live):** user preferences live in the `user_settings`
  table — add new prefs as columns + `lib/settings.ts` parse/merge validation,
  NOT as new `ca:` localStorage keys. The planner gets settings as server
  props from `/plan/[id]` (sender branch, `getUserSettingsState`); in-planner
  toggles PATCH `/api/settings` and mirror the legacy `ca:` keys. Legacy
  `ca:mapZoomMode`/`ca:calendarMode` migrate up once when no row exists — the
  row's existence is the migration flag; don't add another flag. Per-plan
  flags (`ca:reviewPrompted:<planId>`) stay in localStorage.
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
| `src/app/dashboard/page.tsx` | Dashboard: F5 order (hero → Upcoming → invites → map+stats → Past → Places), hosts the F3 modal; header links to `/settings` |
| `lib/settings.ts` | `UserSettings` type, `DEFAULT_SETTINGS`, 1–25 mi hard limits, `parseSettingsPatch`/`mergeSettings`/`legacySettingsPatch`, `YELP_FREE_TIER_DAILY_CALLS` (tested) |
| `lib/user-settings.ts` | `getUserSettings` / `getUserSettingsState` (returns `{ settings, persisted }`) / `saveUserSettings` upsert |
| `src/app/settings/page.tsx` + `components/SettingsView.tsx` + `src/app/api/settings/route.ts` | Settings page (radius default+bounds, zoom mode, calendar mode, Yelp usage meter, address book) + GET/PATCH API |

### Files Batch 9 will touch

| File | What it is |
|---|---|
| `src/app/plan/[id]/memory/page.tsx` | NEW — the G1 keepsake card page (+ its client components) |
| `lib/db/schema.ts` | `date_memories` gains `share_token` + `music_track` (migration via the pattern above). Current columns: id, plan_id, author_id, notes, poem, photo_refs (JSON `[{url, publicId}]`), created_at, updated_at; unique (plan_id, author_id) |
| `public/audio/` | NEW — 2–3 small royalty-free romantic loops (CC0/CC-BY; note attribution if CC-BY) |
| `components/MemoryKeepsake.tsx` | Inline memory block on the plan page — becomes a teaser ("Open your keepsake 💌") once a memory exists |
| `components/DateReviewModal.tsx` | F3 modal — its "write your keepsake →" link moves to the memory page |
| `src/app/plan/[id]/page.tsx` | F2 reflection view — its keepsake link moves to the memory page |
| `src/app/api/memories/route.ts` | Existing memory POST/GET — extend for `music_track` + share toggle (or a small sibling route) |

## Batch 9 — what to build (spec: PLANNER_V2.md G1 — read it verbatim)

`/plan/[id]/memory` — a standalone animated keepsake card: decorative pink
frame, poem centerpiece in a display serif, Cloudinary photo
slideshow/cross-fade + gallery strip, CSS float/fade animation, tap-to-play
background music (browsers block autoplay) from `public/audio/`, per-memory
track stored in `music_track`. Participants-only by default; optional public
share-link toggle via a separate `share_token` that works logged-out. The
inline `MemoryKeepsake` block on the plan page becomes a teaser once a memory
exists; the F3 modal + F2 reflection links point at the memory page.

**Accept (G1):** a past date with a memory opens a full-screen animated card
with poem, photo slideshow, and working tap-to-play music; share toggle
produces a link that works logged-out.

Suggested split (2 tasks, sequential):

1. **Task A — schema + card page:** `share_token`/`music_track` migration
   (sub-agent reports SQL; orchestrator migrates), the memory page itself
   (card, animations, slideshow, music player), music files sourced into
   `public/audio/` (if the sub-agent can't download audio, it should say so —
   sourcing may fall back to the orchestrator or a manual user step).
2. **Task B — sharing + wiring:** share-token mint/toggle + logged-out access
   path, MemoryKeepsake teaser, repoint the F3 modal and F2 reflection links.

## After Batch 9

The PLANNER_V2 roadmap table is then fully shipped. Remaining tracks: launch
steps (below, user-driven) and WP-I business ideas (thinking only — do not
build unprompted).

## Launch status (separate track, user-driven)

`docs/LAUNCH.md` has the manual steps. **Step 0 is buying cutelyask.me — the
domain is NOT registered** (verified against the .me registry RDAP + DNS,
June 11, 2026), so everything else there (DNS → Vercel, Resend domain verify,
Clerk production instance) is blocked on that purchase. Not blocking feature
work.
