# Date Planner — Product Plan

> A tiny custom digital love note that turns into a real date plan.

---

## Current State (as of June 2026)

The following is **live** at https://date-planner-mini-site.vercel.app:

| Feature | Status |
|---|---|
| Personalized invite route `/invite/[token or name]` | ✅ |
| Email OTP + Google OAuth sign-in | ✅ |
| Send invite by email (Resend) | ✅ |
| Recipient walks DatePlanner (evasive No, date/time/activities/food) | ✅ |
| AI activity suggestions via Gemini 3.1 Flash Lite (⭐ starred, cached 4h) | ✅ |
| "Lock it in" → saves plan, generates itinerary server-side | ✅ |
| Itinerary cached in DB (never regenerated for same plan) | ✅ |
| Sender notification email when recipient submits | ✅ |
| `/plan/[id]` — shared plan view with itinerary + tips | ✅ |
| Star ratings (1–5) with notes, per-person, shown to both | ✅ |
| Dashboard — sent invites, past dates, "View plan →" links | ✅ |
| Multiple invites to multiple people | ✅ |

**Stack:** Next.js 16 / React 19 / Tailwind v4 / TypeScript / Supabase (auth + DB) / Resend (email) / Gemini 3.1 Flash Lite / Vercel

---

## V1 Personal Complete — What's Left

V1 is "everything I need to actually use this for real dates." Not a product, not polished for strangers. Full personal functionality.

### 1. Location-aware venue search 🗺️

**The gap:** Right now, dinner and activity choices are generic labels ("Sushi", "Arcade"). A real plan needs real places with real addresses.

**What to build:**
- Sender sets a neighborhood/city when creating an invite (`location` field on invite)
- EntreeStep: "Find restaurants near [location]" → shows real nearby restaurants with ratings
- LineupStep: When activity type maps to a place (Movie → theaters, Arcade → arcades), show real venues
- Itinerary: Gemini receives real venue names + addresses → concrete timeline ("7:30 PM — Nobu Downtown, 105 Hudson St")

**Which API to use — the decision:**

| Option | What it gives you | Free tier | Cost at personal scale | Verdict |
|---|---|---|---|---|
| **Google Places API (New)** | Real-time venues, ratings, hours, photos, addresses | $200/month credit | ~$0.017–0.032/search → **~$0.05/invite** → free | ✅ Recommended |
| Gemini 3.1 Flash Lite (text only) | Plausible-sounding place names, may hallucinate, no real hours | 1,500 req/day | $0 | ❌ Not reliable for real places |
| Yelp Fusion | Great for restaurants, limited for activities | 500 req/day | Free | 🟡 Restaurant fallback if no Google Maps key |
| Foursquare Places | Similar to Google | 1,000 req/day free | Free | 🟡 Good backup |

**Recommendation: Google Places Text Search.**
- One API call per category ("sushi restaurants near Brooklyn, NY")
- Returns real names, ratings (1–5), price level ($ $$ $$$), address, open-now status
- No geocoding step needed — Text Search takes a plain city string
- $200/month credit → covers **11,700+ searches free** → you'd need hundreds of invites/month to pay anything
- Already in the Google ecosystem alongside Gemini

**New env var:** `GOOGLE_MAPS_API_KEY` (separate key from Gemini; restrict it to Places API only in Cloud Console)

### 2. Sender reviews and finalizes the plan

**The gap:** Right now the sender gets a notification and can see the plan, but can't modify it. In real life you might want to swap a restaurant or adjust the time.

**What to build:**
- On `/plan/[id]`, if you're the sender, show edit controls: swap venue, update time, add a note
- "Finalize plan" button locks it and optionally sends recipient a final confirmation email

### 3. Google Calendar integration

**The gap:** You have a plan but it's not on anyone's calendar.

**What to build:**
- After plan is finalized: "Add to Google Calendar" button
- Creates a calendar event with the plan details (name, time, location, itinerary snippet)
- Both sender and recipient can independently add it via a shareable `.ics` link (no OAuth needed for recipient)
- Sender's event can be created via Google Calendar API (requires `calendar.events` scope in OAuth)

**New env vars:** Already have Google OAuth — just add `calendar.events` scope to the sign-in request.

### 4. Post-date memory

**The gap:** After the date you rated it but there's no memory/history beyond that.

**What to build:**
- After rating, optional "Add a memory" — write a note, upload 1–3 photos
- Photos stored in Supabase Storage (free tier: 1 GB)
- Plan page shows the memory below the itinerary

### 5. Sender can cancel / resend an invite

**The gap:** If the recipient never clicks the link, you have no way to resend or cancel.

**What to build:**
- Dashboard: "Resend email" button on pending invites (rate-limited to once/day)
- "Cancel invite" button marks status as `cancelled`

---

## Places API Implementation Plan

### Flow

```
Sender creates invite → sets "neighborhood/city" (e.g. "Lower East Side, NYC")
                                          ↓
Recipient hits EntreeStep
  → taps "Find restaurants near Lower East Side, NYC"
  → POST /api/places?type=restaurant&query=sushi&location=...
  → Google Places Text Search returns 5 venues
  → Recipient picks one (or skips to category fallback)
                                          ↓
Recipient hits LineupStep, picks "Movie"
  → taps "Find theaters near [location]"  
  → POST /api/places?type=movie_theater&location=...
  → Picks a real theater
                                          ↓
"Lock it in" → Gemini gets real venue names in the prompt
  → Itinerary includes "7:30 PM — Alamo Drafthouse, 28 Liberty St"
```

### Schema additions

```sql
-- Add to invites table
ALTER TABLE invites ADD COLUMN location TEXT;

-- Cache place search results to avoid duplicate API calls
CREATE TABLE place_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,  -- hash of (type + location)
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
```

### Caching strategy for places

Same logic as activity suggestions — cache by `(type + location)` for 24 hours in the `place_cache` table (not in-memory, because two different users in the same neighborhood should share results).

**Why DB cache here instead of in-memory?**
- Multiple serverless instances share one DB cache → no duplicate API calls across instances
- 24h TTL is fine for venue data (restaurants don't open/close that fast)
- One Places call cached in DB = free for every subsequent invite in that neighborhood

### Activity type → Places type mapping

```ts
const ACTIVITY_PLACE_TYPE: Partial<Record<ActivityOption, string>> = {
  Movie: "movie_theater",
  Arcade: "amusement_center",
  Museum: "museum",
  Karaoke: "karaoke",
  "Mini golf": "miniature_golf_course",
  "Live music": "bar",          // best approximation
  "Night market": "night_market",
  "Farmers market": "farmers_market",
  "Board games": "board_game_cafe",
};
// Activities like Walk, Sunset view, Scenic drive → no venue needed, skip search
```

---

## LLM Call Budget — Personal V1

| Call | Trigger | Cached? | Est. calls/month (10 dates) |
|---|---|---|---|
| Activity suggestions | Manual "Ask AI" per invite | ✅ 4h in-memory | 10–30 |
| Itinerary generation | Once when plan is submitted | ✅ DB, permanent | 10 |
| **Total Gemini calls** | | | **~20–40/month** |
| Places search | Per activity type per invite | ✅ DB, 24h | 20–40 |
| **Total Places API calls** | | | **~20–40/month** |

**Free tier headroom:**
- Gemini Flash: 1,500 req/day → 45,000/month → **using <0.1%**
- Google Places: $200/month credit → ~6,250 Text Searches → **using <1%**
- Supabase: 500 MB DB, 1 GB storage, 2 GB bandwidth free → **well within**
- Resend: 3,000 emails/month free → **well within**
- Vercel: Hobby free tier → **fine for personal**

**You will pay $0/month for V1 personal use.**

---

## V1 Personal Build Order

1. **Places API integration** — biggest UX upgrade, real venues in itinerary
2. **Sender plan editing** — swap venues, update time after recipient submits
3. **Google Calendar** — "Add to calendar" for both parties
4. **Invite resend/cancel** — quality-of-life
5. **Post-date memory** — photo + note after the date

---

## Public Product Roadmap (after V1 is solid for personal use)

### Phase 1 — Polish for strangers
- Custom domain
- Terms of service + privacy policy
- Google OAuth app verification (required to exceed 100 users)
- Abuse reporting and block mechanism
- Edge-level rate limiting (Vercel middleware, not per-instance Maps)
- Persistent rate limit store in Supabase (replace in-memory Map)

### Phase 2 — Growth
- Shareable plan screenshots (OG image generation via Satori)
- "Powered by Date Night" watermark on free tier
- Referral: "Send your own invite" CTA on the plan page
- Profile customization (name, avatar)
- Public stats page ("X dates planned this month")

### Phase 3 — Monetization
- Stripe subscription: free = 3 invites/month, paid = unlimited + premium themes
- Custom invite themes (color palettes, fonts)
- Priority AI (longer itineraries, more venue options)
- Couple dashboard (shared history, anniversary tracker)

### Phase 4 — Platform
- Venue partnerships / affiliate links
- API access for third-party integrations
- White-label for event planners

---

## Environment Variables — V1 Complete

```txt
# AI
GEMINI_API_KEY=

# Places
GOOGLE_MAPS_API_KEY=      # Restrict to Places API in Cloud Console

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Email
RESEND_API_KEY=

# App
NEXT_PUBLIC_SITE_URL=https://date-planner-mini-site.vercel.app
```

---

## Reference Links

- Google Places API (New) Text Search: https://developers.google.com/maps/documentation/places/web-service/text-search
- Google Places pricing: https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
- Gemini API: https://ai.google.dev/api
- Supabase: https://supabase.com/docs
- Resend: https://resend.com/docs
