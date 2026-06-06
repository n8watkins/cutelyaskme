# Open Work & Roadmap

A living status doc: what's shipped, what's broken, and what's next.

---

## ✅ Recently shipped

- **Venue architecture migration** — recipient picks *categories*; the **sender**
  picks specific venues on `/plan/[id]`, stored in
  `date_plans.selected_entree_venue` / `selected_activity_venues`. Real pins on
  the map. `lib/mock-venues.ts` retired.
- **Venue sources** — Yelp Fusion (`/api/places`) for businesses + Overpass/OSM
  (`/api/natural-places`) for parks/viewpoints/stargazing, both 24h-cached.
- **Per-stop durations → timeline** with Google Calendar links + `.ics` export.
- **Itinerary regenerates on sender save** — `PATCH /api/plans/[id]` re-runs
  Gemini with the chosen venues so the plan page reflects reality.
- **Notify on lock-in** — share / surprise emails.
- **Docs refresh** — README, PROGRESS, this file.

---

## 🐛 Bugs

- **Session expiry shows wrong error** — when the sender's Clerk session expires,
  `/api/places` + `/api/natural-places` return `401 { venues: [] }`, which the UI
  renders as "No spots found." Detect `401` in `SenderPlanningView.fetchVenues`
  and prompt a refresh / re-login.

---

## 🚀 Big feature — Post-date memory & keepsake poem

**Vision:** after the date, the couple captures how it went, and Gemini turns it
into a little keepsake. Each date gets a revisitable "memory page" you can come
back to later.

### Capture flow ("How was it?")
- Prompt for **highlights**, **funny moments**, **things you liked**, free-text
  thoughts.
- Optional **photo upload** from the date.
- Extend the existing star **`RatingWidget` / `date_ratings`** rather than building
  a parallel system.

### Gemini keepsake poem
- Feed the captured inputs **+ the saved itinerary** (venues, activities, date)
  into Gemini → a short, warm poem about the evening.
- Store the generated poem; allow **regenerate** (like the itinerary flow).
- New helper alongside `lib/itinerary.ts` (e.g. `lib/memory-poem.ts`).

### Memory page
- A persistent page per date (e.g. `/plan/[id]/memory` or a section on the plan
  page) showing the poem, photos, highlights, and the original lineup.

### Public vs. private notes  ← important nuance
- **Shared reflections** both people can see (the poem, highlights, photos).
- **Private verdict** visible only to its author — e.g. "honestly never want to go
  back to this place." Key private notes by `raterId`; never expose another
  user's private notes.
- Could feed a personal **preference profile** we build internally over time
  (places/cuisines you liked vs. didn't) to bias future venue suggestions.

### Open sub-tasks
- [ ] Schema: add memory fields to `date_ratings` (or a new `date_memories`
      table) — `poem TEXT`, `highlights TEXT (JSON)`, `private_note TEXT`,
      `photo_refs TEXT (JSON)`, `generated_at`.
- [ ] **Photo storage** — Turso has no blob store. Pick one: Vercel Blob,
      Supabase Storage (a `supabase/` dir already exists), or Cloudinary.
      Decide before building upload.
- [ ] Poem prompt design + JSON/plain-text handling + graceful fallback when
      `GEMINI_API_KEY` is unset.
- [ ] Privacy model: enforce per-user private notes server-side.
- [ ] Memory page route + UI.

---

## 🔌 Investigation — connect a Yelp account & preferences

**Goal:** pull the user's *own* Yelp tastes (saved/favorited spots, past reviews,
preferences) into our venue suggestions.

**Status: NEEDS VERIFICATION — not yet confirmed.**
Preliminary understanding (to validate against current Yelp developer docs): the
**Yelp Fusion API is app-level** (a single API key), **not** a per-user OAuth
login. It exposes public business data (search, details, a few review excerpts)
but historically does **not** give third parties access to a consumer's personal
account — their saved/favorited businesses, preferences, or full review history.
There is no consumer "Log in with Yelp" flow for reading personal activity.

- [ ] Confirm against current developer.yelp.com offerings (Fusion scopes, any
      partner/consumer OAuth program).
- [ ] **If unavailable (likely):** build our *own* preference signal instead —
      let users favorite spots in-app and learn from their picks + post-date
      ratings (ties directly into the preference profile under the memory feature).

---

## 🛠️ Robustness / production-readiness

- [ ] **Server-side geocoding** — move the client-side Nominatim calls in
      `SenderPlanningView` into `lib/geocode.ts` + a `/api/geocode` route (OSM
      policy requires an identifying User-Agent and ≤1 req/s; per-visitor browser
      calls are policy-violating and flaky). Also dedupes the logic shared with
      `api/natural-places`.
- [ ] **Persistent rate limiting** — `date-ideas` uses an in-memory `Map` that
      resets on every serverless cold start. Move to Turso / KV.
- [ ] **Escape venue HTML** in `DateMap` popups (raw interpolation into
      `bindPopup` — minor XSS surface).
- [ ] **Overpass fallback** — single endpoint, no retry; add a mirror or clearer
      timeout messaging.

---

## 📦 Ship it (not live yet)

- [ ] Add `RESEND_API_KEY`, `GEMINI_API_KEY` to `.env.local` + Vercel.
- [ ] Redeploy on Vercel with all env vars.
- [ ] Connect **cutelyask.me** DNS → Vercel; set `NEXT_PUBLIC_SITE_URL`.
- [ ] **OG image** for invite links (`@vercel/og`) — they currently unfurl blank
      when shared in texts.

---

## 🎨 Polish

- [ ] Store hours / "open now" badge on venue cards.
- [ ] "Surprise ending" sender flow — sender picks a secret final stop.
- [ ] Mobile map layout — map as a toggleable drawer (currently a fixed sidebar).
- [ ] **Tests** — none today. Start with pure logic: `timeline` reduce,
      `buildGCalLink` / `downloadICS`, `mapPrice`, itinerary JSON parsing.

---

## ✅ Resolved (kept for history)

- Recipient's venue choices never persisted → fixed by the venue migration.
- Stale venue list on manual activity toggle → moot (recipient venue picker removed).
- Itinerary ignored the sender's venues → fixed (regenerates on save).
