# Open Work

## Bugs (small, fix now)

### 1. Stale venue list on manual activity toggle — `LineupStep.tsx`
When the user manually deselects an activity and picks a different one, the previously fetched venue list for the old activity stays in state. If they ever re-select that activity, the stale list re-appears instantly without re-fetching. Spin already clears state; manual toggle does not.

**Fix:** clear `activityVenueMap / activityVenueOpen / activityVenueLoading` inside `choose()`.

### 2. Session expiry shows wrong error — `EntreeStep.tsx` / `LineupStep.tsx`
If the recipient's Clerk session expires mid-wizard, clicking "Find near →" hits `/api/places`, gets a 401, and the client shows "No venues found. Try a different food type." — indistinguishable from a real empty result. The user has no idea they need to sign in again.

**Fix:** check `res.status === 401` separately and show a "Session expired — please refresh" message, or redirect to `/login`.

---

## Product gap (larger, core correctness issue)

### Recipient's venue choices are never persisted

The `datePlans` table stores the food *category* (`selectedEntree: "Sushi"`) and activity labels (`selectedActivities: ["Movie","Arcade"]`), but **not** the specific venues the recipient picked (e.g. "Nobu Downtown, 195 Hudson St" or "Alamo Drafthouse"). Those venue details only end up in the Gemini itinerary text — if itinerary generation succeeds. If it fails or the prompt omits them, they're gone.

**Impact:** The sender's plan page at `/plan/[id]` shows a mock NYC venue picker (`SenderPlanningView`) that ignores the recipient's real choices entirely. A recipient in Chicago picking a Chicago sushi restaurant sees that reflected in the itinerary — but the sender's view shows hardcoded NYC mock venues as if no choice was made.

**Fix — two parts:**

**Part A — Store real venues in the DB**
- Add `selectedEntreeVenue TEXT` (JSON: `{name, address, lat, lng}`) to `datePlans`
- Add `selectedActivityVenues TEXT` (JSON: `{Activity: {name, address, lat, lng}, ...}`) to `datePlans`
- Populate from the POST `/api/plans` body (already received, currently ignored for storage)
- Push schema to Turso

**Part B — Show real venues on the sender's plan page**
- Replace or gut `SenderPlanningView` — the mock-venue picker is now wrong
- The sender's view should show what the recipient actually chose: real venue names, addresses, and the map with real pins
- `DateMap` also needs updating from `MockVenue` → real `Venue` type

---

## After that

Once venue data is stored and displayed:
- The Leaflet map on the sender view can show real pins from the recipient's chosen venues
- The `SenderPlanningView` mock-venue system and `lib/mock-venues.ts` can be retired entirely
- `DateMap` can accept `Venue[]` instead of `MockVenue[]`
