# Open Work & Roadmap

A living status doc: what's shipped, what's open, what's next.
**The PLANNER_V2 roadmap is fully shipped** — see the status table (with commit
hashes) at the bottom of [`docs/PLANNER_V2.md`](docs/PLANNER_V2.md), and
[`docs/HANDOFF.md`](docs/HANDOFF.md) for conventions + the orchestrator
playbook. For the end-to-end product flow + decisions, see
[`docs/PRODUCT_FLOW.md`](docs/PRODUCT_FLOW.md).

_Last updated: June 11, 2026._

---

## 🚀 Open — launch (the only real blocker)

- [ ] **Buy `cutelyask.me`** — verified June 11, 2026 (registry RDAP + DNS):
      the domain is **not registered**. Nothing in
      [`docs/LAUNCH.md`](docs/LAUNCH.md) can proceed without it. Buying through
      Vercel makes the rest mostly CLI-automatable; an external registrar
      means hand-adding DNS records.
- [ ] The three LAUNCH.md steps once the domain exists: Vercel domain connect,
      Resend domain verify (so invitees actually receive email — the shared
      `onboarding@resend.dev` only delivers to the account owner), Clerk
      production instance (+ own Google OAuth client).
- [ ] Post-launch smoke test: invite → email arrives → wizard → plan → share.
- [ ] Optional niceties: DMARC record, `support@cutelyask.me` in Clerk.

## 🧹 Open — minor housekeeping

- [ ] Trim stop-flow dead code sweep / component split of
      `SenderPlanningView.tsx` (~1600 lines) if it keeps growing — no
      functional issue today.

## 🗺️ Google consolidation — queued next

- [x] Routes API replaces the OSRM demo server for travel legs (same server
      key, Essentials SKU only — no traffic-aware/waypoint-optimize triggers).
- [ ] "Navigate" deep links (google.com/maps/dir/…) on the itinerary +
      calendar exports — no API, free.
- [ ] Static Maps API route snapshot in invite / plan-confirmed emails
      (10k/mo free). Needs its own key: email images send no referrer, so
      protect it with URL signing (signing secret) instead of a referrer
      restriction, API-restricted to Static Maps.

## 💡 Future / thinking only (WP-I — do not build unprompted)

- Monetization candidates: premium keepsakes (animated templates, music
  library, printed card), "Couple+" subscription, reservation affiliate links,
  B2B date-night gift links. Core ask-someone-out flow stays free (it's the
  growth loop).
- Instagram: Basic Display API is dead (Dec 2024). When wanted: Web Share API
  with the keepsake card rendered to an image (`@vercel/og` or canvas) — no
  OAuth.

---

## ✅ Shipped (June 2026, PLANNER_V2 Batches 1–9 + follow-ups)

Highlights — full detail lives in `docs/PLANNER_V2.md` + `docs/HANDOFF.md`:

- **Planner UX (WP-A/B/C/D/E):** map-first layout, configurable wheel-zoom,
  click-to-pick + custom dropped-pin venues, saved home/pickup addresses,
  on-demand per-stop venue searches (zero calls on page load) with per-stop
  price + distance-from-previous sorting, business hours + open-during-date
  badges, Overpass natural-place fixes (UA, mirrors, no-fail-caching), sun
  strip + sunset-aware reordering, routed travel legs with per-leg drive/walk
  toggle, deterministic itineraries (Gemini only writes notes/tips), single
  calendar control (one event vs. per-stop, user setting).
- **Settings (WP-H):** `/settings` + `user_settings` table — radius
  default/bounds, zoom mode, calendar mode, Places usage meter, address book.
- **Post-date lifecycle (WP-F):** ratings/verdicts/memories gate on the date
  actually being over (client + server), read-only reflection view for past
  dates, dashboard "How did your date go?" modal, cancel-a-date with gentle
  notify, dashboard reordering.
- **Keepsake (WP-G):** `/plan/[id]/memory` animated card — poem in a display
  serif, Cloudinary photo cross-fade slideshow, drifting hearts, tap-to-play
  CC-BY music loops (`public/audio/`, attribution on-card), per-memory track,
  public share links via `share_token` that work logged-out.
- **Launch-prep fixes (June 11):** Cloudinary assets are now destroyed when
  photos are removed from a gallery (no more orphans); OG unfurl cards for
  invite links + site-wide default; venue search surfaces session-expiry
  (401 → sign-in prompt) instead of failing silently; `middleware` → `proxy`
  per Next 16.
- **Earlier foundations:** venue architecture migration (sender picks venues),
  memory poem + Cloudinary photo uploads, swipe verdicts → "Places you loved"
  + Reminisce mode, server-side geocoding + caching, persistent rate limiting,
  Vitest suite (164 tests over `lib/*` pure helpers — `npm test`).

## 📚 Resolved investigations (kept for history)

- **Yelp account/preferences import:** not possible — no consumer OAuth or
  saved-places endpoint (verified June 2026). Plan B shipped: own the signal
  via swipe verdicts.
- **Yelp review excerpts:** were paywalled on Yelp's free tier; resolved by
  migrating venue search to Google Places API (New) in July 2026 — reviews
  now come free within the Enterprise+Atmosphere SKU's 1,000 calls/month.
- **Photo storage:** Cloudinary chosen over Vercel Blob / Cloudflare R2
  (free credits + built-in optimization). Signed direct uploads; refs in
  `date_memories.photo_refs`; assets destroyed on removal.
