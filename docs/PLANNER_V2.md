# Planner V2 — Issue Breakdown & Implementation Plan

Source: full product walkthrough feedback (June 2026). Every numbered item maps to
a specific complaint or idea from that session. Organized into work packages
(WP-A … WP-I) that can each be handed to a sub-agent; every item carries enough
context (root cause, files, acceptance criteria) to be implemented independently.

**Decisions already made (do not re-ask):**

| Decision | Choice |
|---|---|
| Routing for travel times | **OSRM public server** (`router.project-osrm.org`) — free, no key, results cached in `place_cache` |
| Yelp business details | **On-demand on venue select** (hours + 3 review excerpts). Cache **7 days** default, **30 days** once a place is 👍-liked. Track daily Yelp API usage, visible in Settings |
| Build order | **WP-A → WP-B → WP-C → WP-D → WP-E** (planner UX first), then **WP-F** (post-date), then **WP-G** (poem card), then **WP-H/I** |
| Poem keepsake card | **Full experience**: designed card template + photos + CSS animation + background music (tap-to-play) + slideshow |

---

## WP-A — Planner layout & map UX

### A1. Map is too small
**Problem:** The map is a cramped sidebar; planning is map-centric and it deserves
most of the screen.
**Files:** `components/sender/SenderPlanningView.tsx` (layout),
`components/sender/DateMap.tsx`.
**Spec:** Desktop: map ≥ 50% of viewport width, full-height sticky column; venue
list/controls in the other column. Mobile: map as an expandable drawer/toggle
(already a TODO in `TODO.md` → Polish).
**Accept:** On a 1440px screen the map occupies at least half the width and full
usable height; no layout overflow at 375px.

### A2. Can't scroll-zoom while hovering the map
**Root cause (confirmed):** `scrollWheelZoom: false` at `components/sender/DateMap.tsx:223`
and `components/HistoryMap.tsx:33`.
**Spec (decided):** Zoom behavior is a **user setting** (lives in `/settings`,
B4) with two modes:
- **Ctrl/⌘ + scroll** (default) — Google-Maps-style; plain scroll passes through
  to the page. Show a brief "hold Ctrl to zoom" overlay hint when the user
  plain-scrolls over the map.
- **Plain scroll** — wheel always zooms the map.
Implementation: Leaflet `scrollWheelZoom: false` + a custom `wheel` handler that
checks the setting/modifier (or Leaflet's `gestureHandling`-style pattern).
**Mobile:** ensure `touchZoom` (pinch), `dragging`, and `tap` are enabled; use
two-finger pan-to-move if the map is inside a scrollable page so one-finger
scrolling the page still works (Leaflet default `dragging` on touch + CSS
`touch-action` tuning).
**Accept:** Default mode: Ctrl+scroll zooms, plain scroll scrolls the page with
a hint shown; switching the setting makes plain scroll zoom. On mobile, pinch
zooms the map and one-finger page scroll is never trapped.

### A3. Date details block wastes left column
**Problem:** Plan details (who/when/vibe) sit in the left vertical column,
stealing planning space.
**Spec:** Move date details to a **full-width header row** at the top of the
planner — larger type, one row (wrap on mobile). Planning columns start below it.
**Files:** `components/sender/SenderPlanningView.tsx`.
**Accept:** Details render as a top banner spanning the full content width; left
column contains only planning controls.

### A4. Deselecting a venue flies the map to New York
**Root cause (confirmed):** `components/sender/DateMap.tsx:56` —
`map.setView([40.73, -73.99], 13)` fallback when there are no stops/markers.
**Spec:** Fallback order: (1) current search-near center, (2) pickup/start
waypoint, (3) user's saved home, (4) last known map center. Never a hardcoded city.
**Accept:** With a search center set, deselecting every venue keeps the map at
the search center.

### A5. Pick a point directly on the map + manual/custom stop locations
**Problem:** "Pick center on map" (drag-the-map flow) is clumsy; and for venue-less
activities (e.g. a sunset spot you know) there's no way to say "THIS point is
where we're going."
**Spec:** Two related features:
1. **Click-to-set search center:** a mode (or always-on with a confirm tooltip)
   where clicking the map sets the search-near center; reverse-geocode via
   existing `/api/geocode` to label it.
2. **Custom venue pin:** per stop, an option "📍 Drop a pin instead" — click the
   map, optionally name it ("Moonrise Overlook"), and that lat/lng+name becomes
   the stop's selected venue (stored in the same `selected_*_venues` JSON shape
   with `source: "custom"`). Itinerary + calendar + travel times treat it like
   any venue.
**Files:** `DateMap.tsx` (click handler, pin layer), `SenderPlanningView.tsx`
(mode state, custom venue shape), `lib/venues.ts` (type union).
**Accept:** Can create a stop whose venue is a hand-dropped named pin; it
persists on save and shows on plan page + map + calendar export.

---

## WP-B — Addresses, search defaults & settings

### B1. Save home + pickup addresses; usable while planning
**Problem:** Saved addresses exist but live at the bottom of the dashboard;
home/pickup aren't first-class.
**Spec:** Add a `label` type to `saved_addresses` (`home` | `pickup` | `custom`).
In the planner's WaypointPicker, allow saving the typed address inline
("save as Home / save as…") without going to the dashboard. Dashboard keeps a
compact address book but moves it out of the bottom (into Settings or a profile
card — see B4).
**Files:** `lib/db/schema.ts` (savedAddresses + migration),
`components/SavedAddresses.tsx`, `components/sender/SenderPlanningView.tsx`
(WaypointPicker), `src/app/api/addresses/route.ts`.
**Accept:** From the planner I can type an address, click "save as Home," and it
appears pre-filled next session.

### B2. Default search center = pickup address
**Spec:** When a plan has a pickup point (or the user has a saved pickup/home),
initialize the search-near center there instead of empty/last-city. Always
overridable via search or map click (A5).
**Accept:** Opening the planner with a saved pickup shows results near pickup
without typing anything.

### B3. Search radius: default range 1–25 miles
**Problem:** Current slider is 1–60 mi — too far.
**Spec:** Slider bounds **1–25 mi**, default value e.g. 5 mi. Bounds and default
become user settings (B4). Note: Yelp hard-caps at 25 mi anyway; Overpass calls
clamp accordingly.
**Files:** `SenderPlanningView.tsx` (slider), settings (B4).
**Accept:** Slider spans 1–25 by default and honors user-configured bounds.

### B4. Settings page
**Spec:** New `/settings` (auth-gated) + `user_settings` table (1 row per user,
JSON or columns): default radius, radius bounds, **map zoom mode** (A2,
absorbs the `ca:mapZoomMode` localStorage key), **calendar export mode** (E3:
one event vs. one event per stop), default map style (future), plus the
**Yelp API usage meter** (see C7). Move the address book here too.
Future hooks: theme/format restyle ("change the entire format/style eventually").
**Files:** new `src/app/settings/page.tsx`, `src/app/api/settings/route.ts`,
schema + migration.
**Accept:** Changing default radius in Settings changes the planner's initial
slider value.

---

## WP-C — Search flow, venue data & Yelp economy

### C1. Don't burn Yelp calls — search one stop at a time, on demand
**Problem:** Venue fetches fire too eagerly. Desired flow: first settle the
*idea* of the date (sunset view → bookstores → tacos, and the order), then
deliberately search venues per stop.
**Spec:** Restructure the planner into a light stepper:
1. **Lineup review** — the chosen activities as reorderable chips (drag or
   up/down), informed by the sun timeline (D2).
2. **Per-stop venue picking** — venues fetch **only** when the user opens a stop
   (and only re-fetch on explicit "Search" / changed center+radius). No fetch on
   page load.
**Files:** `SenderPlanningView.tsx` (fetchVenues call sites, stepper state).
**Accept:** Loading the planner makes **zero** `/api/places` calls until a stop's
"Search" is clicked.

### C2. Sort results by proximity to the previous stop
**Spec:** When picking the venue for stop N, sort candidates by distance from
stop N−1's chosen venue (or pickup point for stop 1). Show the distance on each
card ("0.4 mi from Date Tacos"). Haversine is fine for sorting; OSRM (D3) only
for chosen routes.
**Accept:** Result cards show distance-from-previous and are sorted ascending.

### C3. Per-activity price level
**Problem:** Price is global; tacos can be cheap while dinner is fancy.
**Spec:** Each stop gets its own price selector ($–$$$$, default from the
recipient's overall budget vibe), passed as Yelp's `price` param per-stop search.
**Files:** `SenderPlanningView.tsx`, `src/app/api/places/route.ts` (already
accepts price? verify), `lib/venues.ts` `mapPrice`.
**Accept:** Setting stop 1 to $ and stop 2 to $$$ yields different price-filtered
result sets.

### C4. Business hours + open-during-date badge
**Spec:** On venue **select/click** (not list render), call Yelp **Business
Details** (`GET /v3/businesses/{id}`) via a new `src/app/api/places/[id]/route.ts`.
Show hours for the date's weekday and a badge: ✅ open during your slot /
⚠️ closes at 9pm / ❌ closed that day.
**Caching:** `place_cache`, TTL **7 days**; bump to **30 days** when that venue
has a 👍 verdict from this user.
**Accept:** Selecting a venue shows that weekday's hours and an open/closed
badge for the planned time window.

### C5. Yelp review excerpts
**Spec:** Same on-demand fetch: Yelp **Reviews** endpoint
(`GET /v3/businesses/{id}/reviews`, returns 3 excerpts + rating + author).
Render in an expandable "Reviews" section on the selected-venue card. Same
cache policy as C4 (piggyback both fetches in one details call from our API).
**Accept:** A selected Yelp venue can expand to show 3 review excerpts.
**Status (verified live, June 2026):** the Reviews endpoint returns 404 on our
key — Yelp moved review excerpts to a **paid tier**. Code is wired and degrades
gracefully (explains why + "Read reviews on Yelp →" link to the business page);
excerpts will light up automatically if the Yelp plan is ever upgraded.

### C6. Sunset view (and other natural activities) seemingly not connected
**Status:** `lib/venues.ts:53` does map `"Sunset view" → "viewpoint"` and
`/api/natural-places` (Overpass) exists — but in practice no results appeared.
**Spec (investigate then fix):**
1. Reproduce: trigger a Sunset-view stop search, log the Overpass query + raw
   response (likely culprits: tag query too narrow, radius clamp, timeout,
   or the stepper never calling natural-places for that activity).
2. Broaden discovery for sunset-worthy spots: Overpass union of
   `tourism=viewpoint`, `natural=peak`, `natural=beach`, `natural=cliff`,
   plus `leisure=park` with elevation names. Rank by distance.
3. If still sparse, fall back to a "drop a pin" prompt (A5) with a friendly
   "know a spot? drop a pin" empty state.
**Accept:** A Sunset-view stop search near a real city returns ≥1 naturalistic
candidate, or shows the drop-a-pin empty state (never a silent dead end).

### C7. Yelp API usage meter
**Spec:** Increment a counter per outbound Yelp call (search, details, reviews)
in a small `api_usage` table (`service`, `day`, `count`). Surface in Settings:
"Yelp: 23 calls today" (+ Yelp's free-tier daily limit for reference). Reuse the
`rate_limits` table pattern or add `api_usage`.
**Accept:** Settings shows today's Yelp call count, incrementing live after a search.

---

## WP-D — Time intelligence (sun + travel)

### D1. Sun timeline pinned and always visible
**Problem:** "Still bright — sunset 8:06 PM" hides at the bottom; the user plans
*around* it.
**Spec:** A persistent **sun strip** at the top of the planner (inside/below the
A3 header): golden hour, sunset, dusk markers on a horizontal time axis, with the
date's planned window overlaid. Stays visible (sticky) while scrolling stops.
Data already computed via `suncalc` in `SenderPlanningView` — relocate + restyle.
**Accept:** Sunset time is visible without scrolling, at every scroll position.

### D2. Schedule ordering aware of sunset
**Problem:** A 6:30 start with sunset at 8:06 means "Sunset view" can't be first.
**Spec:** Using existing `lib/sun.ts` warnings + per-stop durations, compute each
stop's projected start time; if a sun-sensitive stop lands outside its window,
show an inline suggestion: "🌅 Sunset view works best ~7:45–8:20 PM — move it to
the end?" with a one-tap **reorder** action. Pure helper
(`lib/schedule.ts`: `suggestOrder(stops, durations, sun)`) + unit tests.
**Accept:** With start 6:30 PM and sunset 8:06 PM, putting Sunset view first
produces a visible suggestion; accepting it reorders the lineup so it's last.

### D3. Travel distance + time between stops
**Decision:** OSRM public server.
**Spec:** New `src/app/api/route/route.ts`: takes ordered waypoints
(pickup → stop1 → … → stopN), calls
`router.project-osrm.org/route/v1/driving/{lon,lat;…}` once per leg-set, returns
per-leg `distanceMeters` + `durationSec`. Cache by rounded coords (4 decimals)
in `place_cache`, 30-day TTL. Timeline shows between entries:
"🚗 12 min · 4.3 mi". Calendar export (E3) includes travel buffers.
**Mode (decided):** Driving by default. When a leg is **< 0.8 mi**, also fetch
the walking profile (`/route/v1/foot/…`) and render a toggle on that leg —
"🚗 4 min / 🚶 12 min" — the user picks either; the chosen mode persists per leg
(stored with the plan's waypoint/leg data) and feeds the timeline + calendar.
**Fallback:** OSRM unreachable → haversine × 1.3 at 28 mph city average,
flagged "~estimate".
**Accept:** The timeline between two chosen venues shows drive time + distance
without the user doing anything; values cached on repeat views.

---

## WP-E — Itinerary integrity & calendar

### E1. Gemini invents stops ("Cozy Corner coffee and chat")
**Root cause (confirmed):** the itinerary prompt lets Gemini embellish; the plan
page renders whatever timeline it returns.
**Spec:** In `lib/itinerary.ts`: prompt must state "Use EXACTLY these stops, in
this order — do not add, remove, or rename venues." Then **validate**: drop any
timeline entry whose activity/venue doesn't match a selected stop; if counts
mismatch, fall back to the deterministic timeline we already build from
durations. Gemini's value is only the playful `note` per stop.
**Accept:** Generated itineraries contain exactly the selected stops — N stops
in, N timeline entries out, every venue name matching.

### E2. "Pro tips" — unexplained box
**Root cause (confirmed):** Gemini's `tips` array, rendered at
`src/app/plan/[id]/page.tsx:255`.
**Spec:** Keep but constrain: prompt tips to reference only the actual
stops/logistics (parking, reservations, sunset timing); cap at 3; relabel the box
"Tips for tonight ✨". (If they're still generic noise after that, delete the
section — implementer's judgment after one test generation.)
**Accept:** Tips mention the actual venues/activities of the plan or the section
doesn't render.

### E3. One calendar button (clarified June 2026)
**Problem:** Multiple per-stop calendar links + ics export scattered around.
**Spec:** Single **"Add to calendar"** button. A **setting** (B4/WP-H; localStorage
key until the Settings page exists) controls the export shape:
- **One event** — a single event spanning the whole date window, full itinerary
  + travel legs + plan link in the description (`buildGCalLink` /
  `buildItineraryText` already do most of this).
- **One event per stop** — every stop becomes its own event at its own
  time/venue (each with the full itinerary + link in the description).

Per-format reality:
- **.ics** supports both modes in one click — one VEVENT or N VEVENTs in a
  single downloaded file (the current `downloadICS` already writes N).
- **Google Calendar web links** are one-event-per-click (no batch URL API).
  In per-stop mode the button expands a small ordered list — "1️⃣ Dinner ·
  2️⃣ Bookstore · 3️⃣ Sunset" — each link pre-filled, so it's tap-tap-tap.
  In one-event mode it's a single link.

Remove the scattered per-stop calendar links from the timeline rows.
**Accept:** Exactly one calendar control; with "one event" set, both formats
produce a single all-evening event; with "per stop" set, .ics downloads N
events in one file and the GCal flow offers N pre-filled links.

---

## WP-F — Post-date lifecycle

### F1. Rating gated until after the date actually happens
**Problem:** Verdicts/memory unlock at `confirmedAt`; should unlock only after
the date's **end time** has passed.
**Spec:** Compute `dateEnd` (selected date + last stop end time, from the saved
timeline). Gate `VenueVerdicts`, `RatingWidget`, and `MemoryKeepsake` rendering
+ their POST routes on `now > dateEnd` (server-side too). Before that, show
"come back after your date 💞".
**Files:** plan page, `src/app/api/verdicts/route.ts`, `src/app/api/memories/route.ts`.
**Accept:** Before the date's end time, rating UI is locked client + server;
after, it's available.

### F2. Past dates are read-only
**Problem:** Old dates still open in full edit mode.
**Spec:** When `dateEnd` has passed, `/plan/[id]` (sender view) renders a
**reflection view**: what happened (final itinerary, venues, map), how it went
(rating, verdicts, memory/poem, photos), plus "did you go anywhere else?" —
an optional extra-stop note appended to the memory. No venue editing, no
itinerary regeneration.
**Accept:** Opening a past date shows the reflection view; no edit controls.

### F3. Dashboard "How did your date go?" pop-up
**Spec:** On dashboard load, if any confirmed plan's `dateEnd` is in the past
and the user has no rating/verdicts for it → modal: "How did Tuesday's date
go? 💘" → star rating + Tinder-style swipe cards (one per visited venue:
👍 / 😐 / 👎, reusing `VenueVerdicts` logic) → done state links to the memory
page ("write your keepsake →"). Dismissible; don't re-prompt more than once per
plan (store `promptedAt` or local flag + server check).
**Accept:** First dashboard visit after a date triggers the modal once; completing
it stores rating + verdicts.

### F4. Cancel a date
**Spec:** Add `status` to `date_plans` (`draft | sent | confirmed | canceled`)
or a `canceledAt` timestamp. "Cancel this date" (with confirm) on the plan page
→ recipient link shows a graceful "this one's been called off 💔" state; sender
dashboard moves it out of Upcoming. **Notify (decided):** if the plan was
already shared/sent, email + push the other person on cancel (gentle copy, no
guilt: "tonight's plan was called off — more soon 💌").
**Accept:** Canceling hides the plan from Upcoming, the share link shows the
canceled state, and nothing about it can still be edited.

### F5. Dashboard layout polish
**Problem:** "The whole dashboard situation looks a little weird."
**Spec:** Re-order: (1) "How did it go?" prompt / next upcoming date hero,
(2) Upcoming, (3) Your Map + Stats, (4) Past dates, (5) Your Places. Address
book moves to Settings (B4). Tighten visual rhythm (consistent card paddings,
section headers).
**Accept:** Dashboard reads top-down as: act on what's next → browse history;
no address book at the bottom.

---

## WP-G — Memory keepsake card (decided: full experience w/ music)

### G1. Dedicated memory page as a designed card
**Spec:** `/plan/[id]/memory` — a standalone, beautiful keepsake:
- **Card template:** decorative frame (soft gradients, hearts/foliage, the
  app's pink palette), date title + date, the **poem** as the centerpiece in a
  display serif.
- **Photos:** Cloudinary images in a gentle **slideshow/cross-fade**, plus a
  small gallery strip.
- **Animation:** CSS float/fade (hearts drifting, poem fade-in on load).
- **Music (decided):** tap-to-play background track (a "♪" button — browsers
  block autoplay). Source 2–3 **royalty-free romantic loops** (CC0/CC-BY from
  e.g. Pixabay Music, Free Music Archive, Kevin MacLeod/incompetech with
  attribution) — soft piano / lo-fi / acoustic. Bundle as small looped MP3/OGG
  in `public/audio/`; selectable per memory, stored in `music_track`.
- **Shareable:** participants-only by default; optional public share-link toggle
  (separate token) so it can be sent like a card.
- Replaces the inline `MemoryKeepsake` block on the plan page with a teaser
  ("Open your keepsake 💌") once a memory exists.
**Files:** new route + components; `date_memories` gains `share_token`,
`music_track`; reflection view (F2) links here.
**Accept:** A past date with a memory opens a full-screen animated card with
poem, photo slideshow, and working tap-to-play music; share toggle produces a
link that works logged-out.

---

## WP-H — Settings & platform (rolls up B4, C7)

`/settings`: search defaults (radius default + bounds), address book, Yelp usage
meter, future: theme/style switcher, notification prefs. One sub-agent task once
B4/C7 specs land.

---

## WP-I — Business & future (no build yet — thinking)

### I1. Monetization candidates
- **Premium keepsakes:** free = simple card; paid = animated templates, music
  library, printed/mailed physical card (print-on-demand margin).
- **Subscription ("Couple+"):** unlimited active plans, anniversary/date-night
  reminders, advanced recommendations from verdict history, photo storage beyond
  a free cap.
- **Affiliate/booking:** reservation deep-links (OpenTable/Resy/Yelp Reservations)
  with affiliate revenue; flowers/dessert add-on partnerships.
- **B2B angle:** "date night" gift links businesses can buy as perks.
- Keep the core ask-someone-out flow free forever — it's the growth loop (every
  invite link is an acquisition).

### I2. Instagram
**Reality check (research, June 2026):** Instagram Basic Display API is dead
(Dec 2024). "Login with Instagram" / content publishing now requires a
**Business/Creator** account + app review — not viable for casual couples.
**Recommended instead:** Web Share API (`navigator.share`) with the keepsake
card rendered to an image (`@vercel/og` or client canvas) — one tap shares to
IG Stories/DMs/iMessage natively on mobile, no OAuth at all.
**Accept (when built):** "Share" on the memory card produces an image via the
native share sheet.

---

## Open questions — ALL RESOLVED (June 2026)

1. **A2 zoom:** a setting — **Ctrl/⌘+scroll default**, plain-scroll optional;
   full mobile gesture support (pinch zoom, no scroll-trapping). → spec in A2.
2. **D3 travel mode:** **driving default**; legs < 0.8 mi also fetch walking and
   show a per-leg drive/walk toggle. → spec in D3.
3. **F4 cancel:** **notify** the other person when a shared plan is canceled. → spec in F4.
4. **G1 music:** **yes** — source royalty-free romantic loops (CC0/CC-BY),
   bundle locally. → spec in G1.

## Sub-agent batches (in build order) — STATUS as of June 10, 2026

| Batch | Items | Status | Commit |
|---|---|---|---|
| 1 | A1, A2, A3, A4, D1 | ✅ **shipped + deployed** | `9cfacf8` |
| 2 | B1, B2, B3 (+ `kind` migration) | ✅ **shipped + deployed** | `b121432` |
| 3 | C1, C2, C3 (+ `lib/geo.ts`) | ✅ **shipped + deployed** | `634ca74` |
| 4 | A5, C6 (Overpass UA/mirror/cache fix) | ✅ **shipped + deployed** | `d815e37` |
| 5 | C4, C5, C7 (+ `/api/places/[id]`, `api_usage`) | ✅ **shipped + deployed** (C5 = paid-tier, degrades gracefully) | `b0a051e` |
| 6 | D2, D3, E1, E2, E3 (+ `leg_modes` migration) | ✅ **shipped + deployed** | `de8dab0` |
| 7 | F1–F5 (+ `canceled_at` migration) | ✅ **shipped + deployed** | `005cace` + `b9ec917` + `2706e25` |
| 8 | B4 + WP-H (Settings; absorbs `ca:mapZoomMode` + calendar mode + usage meter) | ✅ **shipped + deployed** | `c88ebb3` + `b4d6d8e` |
| 9 | G1 keepsake card (+ `share_token`/`music_track` migration) | ✅ **shipped + deployed** | `2f93a9a` + `e66120a` |

For project conventions, verification loop, deploy steps, and the orchestrator
playbook, see [`HANDOFF.md`](HANDOFF.md).
