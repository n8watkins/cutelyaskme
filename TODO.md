# Open Work

## ✅ Resolved (kept for history)

- **Recipient's venue choices are never persisted** — resolved by the venue
  architecture migration. Venue selection moved off the recipient entirely; the
  **sender** now picks venues on `/plan/[id]`, stored in
  `date_plans.selected_entree_venue` / `selected_activity_venues` via
  `PATCH /api/plans/[id]`. `DateMap` renders real pins. `lib/mock-venues.ts` retired.
- **Stale venue list on manual activity toggle** (`LineupStep`) — moot; the
  recipient-side venue picker was removed.

---

## Bugs

### Session expiry shows wrong error — sender venue search
If the Clerk session expires while the sender is on `/plan/[id]`, `/api/places`
and `/api/natural-places` return `401 { venues: [] }`, which the UI renders as
"No spots found — try a wider range or different location." — indistinguishable
from a genuinely empty result.

**Fix:** detect `res.status === 401` in `SenderPlanningView.fetchVenues` and show
a "Session expired — please refresh" state.

---

## Product gaps

### Store hours on venue cards
Surface Yelp business hours / an "Open now" badge on each `VenueCard` (Yelp
Business Details endpoint, or link out to the Yelp page).

### "Surprise ending" sender flow
`Surprise ending` is in the activity list but has no venue search (it's in
`NO_VENUE_ACTIVITIES`). Let the sender choose a secret final stop that the
recipient doesn't see until the date.

---

## Code quality (nice to have)

- **Extract geocoding helper** — the lat/lng-parse → Nominatim pattern and the
  hardcoded `User-Agent` string are duplicated across `SenderPlanningView.tsx`
  (forward + reverse) and `api/natural-places/route.ts`. Pull into `lib/geocode.ts`.

---

See `docs/PROGRESS.md` for the broader roadmap (deploy, custom domain, etc).
