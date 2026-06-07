# Open Work & Roadmap

A living status doc: what's shipped, what's broken, and what's next.
For the end-to-end product flow + decisions (auth, notifications, review states),
see [`docs/PRODUCT_FLOW.md`](docs/PRODUCT_FLOW.md).

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

### Public vs. private
- **Shared reflections** both people can see (the poem, highlights, photos).
- **Private verdict** — a simple **pass/fail swipe** per place (see the next
  feature), visible only to its author. Never expose another user's verdict.

### Sub-tasks
- [x] Schema: `date_memories` (`plan_id`, `author_id`, `notes`, `poem`,
      `photo_refs`, timestamps; unique per author) — pushed to Turso.
- [x] Poem generation — `lib/memory-poem.ts` (Gemini 2.5 Flash, thinking off);
      `POST /api/memories` saves notes + (re)generates the poem. Verified live.
- [x] Privacy — participant-only check server-side; one memory per author.
- [x] Capture + display UI — `MemoryKeepsake` on the plan page (notes textarea,
      generate/rewrite, poem card). _(Move to a dedicated memory page later.)_
- [x] **Photo upload to Cloudinary** — signed direct uploads (`GET
      /api/memories/sign` → browser → Cloudinary), refs persisted via
      `PUT /api/memories/photos`, optimized thumbnail gallery in `MemoryKeepsake`.
      Verified end-to-end (upload + destroy).
- [ ] Orphan cleanup — removing a photo drops it from `photo_refs` but leaves the
      Cloudinary asset; add a `destroy` call later if storage matters.
- [ ] Photo storage notes — Turso has no blob store; not using Supabase.
      Free-tier options (researched June 2026):
      - **Cloudinary** — ~25 GB (25 credits/mo; 1 credit = 1 GB storage / 1 GB
        bandwidth / 1k transforms, shared). Built-in resize/optimize/CDN. Best
        for an image feature; ~5× Vercel's storage. **Recommended.**
      - **Vercel Blob** — 5 GB, 100 GB transfer, on our existing stack, hard cap
        with no overage billing. Simplest, but we'd resize images ourselves.
        ~3,000–5,000 photos @ 1–1.5 MB.
      - **Cloudflare R2** — 10 GB, **zero egress fees ever**, 1M writes / 10M
        reads free. Best raw-storage + free-serving option (needs S3 plumbing).
      - **DECIDED: Cloudinary** (optimization + most storage). Add
        `CLOUDINARY_*` env vars; upload via signed/unsigned preset; store the
        returned secure URL + public_id in `photo_refs`.
- [ ] Poem prompt design + JSON/plain-text handling + graceful fallback when
      `GEMINI_API_KEY` is unset.
- [ ] Privacy model: enforce per-user private notes server-side.
- [ ] Memory page route + UI.

---

## 🔁 Big feature — Swipe verdicts → recommendations & "Reminisce" mode

**Vision:** after a date, rate each place we went with a dead-simple **pass/fail
swipe** ("would we go back?" — Tinder-style). The places we liked build up into a
pile we own, and that pile powers two things: smarter recommendations next time,
and a "reminisce" option to deliberately revisit a favorite.

### 1. The swipe
- Per visited venue, **three states** — 👍 loved / 😐 neutral (default; didn't go
  / closed) / 👎 nope. One tap, per-user. Only available once the plan is
  **confirmed**.
- Captured on the post-date memory page, alongside the poem/photos.

### 2. Recommend what we loved
- When the sender is picking a venue for an activity (e.g. Coffee), surface
  **"Places you loved"** for that activity type at the top of the picker —
  pulled from past 👍 swipes — above the fresh Yelp/Overpass results.

### 3. "Reminisce" mode
- An explicit option when planning: *"Take me somewhere we've been before."*
- Lists all previously-liked venues (optionally filtered by activity) so we can
  re-pick a favorite instead of searching from scratch — a whole date built from
  greatest hits.

### Sub-tasks
- [x] Schema: `venue_verdicts` (`user_id`, `plan_id`, `activity`, `venue` JSON
      snapshot, `status`, `created_at`) — pushed to Turso.
- [x] Three-state swipe UI (`VenueVerdicts`) + `POST /api/verdicts`, gated on the
      plan being confirmed (`confirmedAt`).
- [x] De-dupe — unique `(user_id, venue_id)` so re-rating updates in place.
- [x] Liked-places query (`GET /api/verdicts?liked=true`) wired into
      `SenderPlanningView` — "💘 Places you loved" surfaces matching past
      favorites at the top of each stop's picker, deduped against fresh results.
- [x] "Reminisce" mode — collapsible panel in the planner listing all liked
      venues; one-tap "Use for [activity]" drops a favorite into a matching stop.

---

## 🔌 Investigation — connect a Yelp account & preferences

**Goal:** pull the user's *own* Yelp tastes (saved/favorited spots, past reviews,
preferences) into our venue suggestions.

**Status: CONFIRMED — not possible (verified June 2026 against Yelp docs).**
The Yelp Fusion API authenticates with an **app-level API key** (OAuth 2.0 for
queries was removed in 2018). The only OAuth flow that exists is for **Yelp for
Business accounts** — it lets a partner manage a business owner's claimed
listings / respond to reviews ("Get Businesses Associated with Access Token"
returns claimed *business* IDs). There is **no consumer "Log in with Yelp"**
flow and **no endpoint** that exposes an individual's saved/favorited
businesses, personal preferences, or their own reviews.

- [x] Verified against developer.yelp.com — consumer account access is not offered.
- [x] **Plan B chosen — own our preference signal** via the swipe-verdict
      feature above (👍/👎 per place → "Places you loved" + Reminisce mode).
      No dependency on Yelp account data.

---

## 🛠️ Robustness / production-readiness

- [x] **Server-side geocoding** — `/api/geocode` (forward + reverse) replaces the
      browser Nominatim calls in `SenderPlanningView` (browsers drop the required
      User-Agent header → the map wasn't responding to "Search near"). Fixed.
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
