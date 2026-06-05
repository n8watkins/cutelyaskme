# Progress & Next Steps

_Last updated: June 2026_

---

## What's Built

### Infrastructure

| | |
|---|---|
| Framework | Next.js 16, React 19, TypeScript, Tailwind v4 |
| Auth | Supabase — email OTP + Google OAuth |
| Database | Supabase Postgres — invites, date_plans, date_ratings, profiles |
| Email | Resend — invite emails + sender notification on plan submission |
| AI | Gemini 2.5 Flash — activity suggestions + itinerary generation |
| Map | Leaflet / OpenStreetMap — no API key, free |
| Deployment | Vercel — https://date-planner-mini-site.vercel.app |

---

### Her Flow (recipient)

Step-by-step wizard she walks through after clicking the invite link.

| Step | What happens |
|---|---|
| Invite | Personalized ask with evasive "No" button, confetti on accept |
| Date | Calendar picker with quick-select suggestions |
| Time | Preset time cards + custom time picker, blocks past times |
| Activities | Grid of time-filtered options, budget vibe filter (low-key / cozy / treat), ⭐ "Ask AI" section with cached Gemini picks, local spinner |
| Food | Food category selection |
| **Dress vibe** _(new)_ | One question: casual / casual-cute / dress up / match whatever |
| Summary | Full recap of all picks, editable, "Lock it in" button |
| Submit | POST to `/api/plans` → itinerary generated → redirect to plan page |

---

### Your Flow (sender)

| Feature | Where |
|---|---|
| Sign in | `/login` — email OTP or Google OAuth |
| Create invite | `/send` — name + email → invite created in DB, email sent via Resend |
| Dashboard | `/dashboard` — all sent invites with status badges, "View plan →" for completed ones, past dates |
| Notification | Email from Resend when she locks in the plan |
| **Planning view** _(new)_ | `/plan/[id]` as sender → full planning UI (see below) |

**Planning view breakdown:**
- Her picks panel — date, time, activities, food, dress vibe, all at a glance
- Pick your spots — expandable venue cards per activity/food slot with ratings, price level, vibe note
- Leaflet map — numbered pins appear as you select venues, dashed pink route line connects them in order
- Route builder — reorder stops with ↑↓ arrows (default: activity → dinner → activity)
- Dress code suggestion — auto-generated from venue price levels × her vibe
- Finalize — "Surprise her" (she gets time + dress code only) or "Send the deets" (full plan)
- All venue data is simulated with real NYC coordinates; swapping to Google Places is one file change

---

### AI & Caching

| Call | Frequency | Cached | Notes |
|---|---|---|---|
| Activity suggestions | Manual "Ask AI" | ✅ 4h in-memory, keyed by (period:time:date) | Returns `fromCache` flag shown as label |
| Itinerary generation | Once per plan submission | ✅ Stored in DB permanently | Never regenerated for same plan |
| Dress code suggestion | Client-side on planning view | ✅ Pure function, no API call | Based on venue price levels + her vibe |

---

### Database Schema

```
profiles        — id, display_name (auto-created on signup)
invites         — token, sender_id, recipient_name, recipient_email, status, location
date_plans      — invite_id, sender_id, recipient_id, selections, itinerary (JSONB), dress_vibe
date_ratings    — plan_id, rater_id, score (1-5), note
```

Schema SQL: `supabase/schema.sql`

---

## What Needs External Setup

The app is fully built but won't work until these are configured:

| Service | What to do | Env var |
|---|---|---|
| Supabase | Create project → run `supabase/schema.sql` → enable Google provider | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Google Cloud | Create OAuth client → paste into Supabase Google auth settings | (set in Supabase dashboard, not app) |
| Resend | Create account → verify domain → create API key | `RESEND_API_KEY` |
| Gemini | Google AI Studio → create API key | `GEMINI_API_KEY` |
| Vercel env vars | `vercel env add` for each above | `NEXT_PUBLIC_SITE_URL` |

Local dev: copy `.env.example` → `.env.local`, fill in values, run `npm run dev`.

---

## Next Steps

### Immediate — wire up what's simulated

- [ ] **Google Places API** — replace `lib/mock-venues.ts` with real API calls
  - Add `GOOGLE_MAPS_API_KEY` env var (restrict to Places API in Cloud Console)
  - Add `location` field to invite creation form + invites DB table
  - Create `/api/places` route: Google Places Text Search → cache results in Supabase `place_cache` table (24h TTL)
  - `getVenuesForFood()` and `getVenuesForActivity()` switch from mock data to API
  - Map pins become real coordinates from Places results
  - Cost: ~$0 at personal scale ($200/month free credit covers ~11,700 searches)

- [ ] **Finalize action actually persists** — right now "Surprise her" / "Send the deets" shows a success screen but doesn't write to the DB or send an email
  - Add `finalized_at`, `sender_venues` (JSONB), `surprise_mode` (bool), `dress_code_message` columns to `date_plans`
  - `/api/plans/[id]/finalize` — PATCH endpoint, updates plan, triggers email
  - Resend email for "Send the deets": her venues, itinerary, time
  - Resend email for "Surprise her": just time + dress code message

- [ ] **Supabase setup** — run through the checklist above so the app is actually live end-to-end

### Short term — V1 personal complete

- [ ] **Sender can edit a finalized plan** — swap a venue, update the time, re-send
- [ ] **Invite resend / cancel** — "Resend email" on pending invites (rate-limit: once/day), "Cancel" button
- [ ] **Google Calendar** — "Add to my calendar" generates a `.ics` file both parties can download (no extra OAuth scope needed for `.ics`)
- [ ] **Post-date memory** — after rating, option to add a short note + 1-3 photos stored in Supabase Storage
- [ ] **Walking time estimates** between stops on the route builder (Google Routes API or just straight-line haversine calc for now)
- [ ] **ProgressHearts accessibility** — aria-live region announcing step changes

### Medium term — polish before sharing

- [ ] Custom domain (connect to Vercel)
- [ ] OG image for invite links (Satori / @vercel/og) — shows recipient name + date details when link is shared
- [ ] Mobile map layout — map currently sits below the planning panels; on mobile it should be a toggleable drawer
- [ ] Sender can preview what she'll receive before finalizing
- [ ] "Copy invite link" button on dashboard copy works without `window.onclick` (move to a proper client component)

### Long term — public product

See `docs/PRODUCT_PLAN.md` for the full roadmap.

TL;DR:
1. Domain + ToS + privacy policy
2. Google OAuth app verification (required past 100 users)
3. Stripe subscription (free = 3 invites, paid = unlimited)
4. Persistent rate limiting (move from in-memory Map to Supabase)
5. Edge-level rate limiting via Vercel middleware

---

## File Map

```
date-planner-mini-site/
├── src/
│   ├── app/
│   │   ├── page.tsx                    landing / redirect to dashboard
│   │   ├── login/page.tsx              email OTP + Google sign-in
│   │   ├── send/page.tsx               create invite
│   │   ├── dashboard/page.tsx          sent invites + past dates
│   │   ├── invite/[recipient]/page.tsx token or name-based invite route
│   │   ├── plan/[id]/page.tsx          role-aware: sender → planning view, recipient → itinerary
│   │   ├── auth/callback/route.ts      OAuth callback
│   │   └── api/
│   │       ├── date-ideas/route.ts     Gemini activity suggestions (cached)
│   │       ├── invites/route.ts        create invite + list sender's invites
│   │       ├── plans/route.ts          submit plan + generate itinerary
│   │       └── ratings/route.ts        upsert star rating
│   └── middleware.ts                   session refresh + auth guard
├── components/
│   ├── auth/LoginForm.tsx
│   ├── date-planner/
│   │   ├── DatePlanner.tsx             main wizard state machine
│   │   ├── InvitationStep.tsx          evasive No, accept
│   │   ├── DateStep.tsx                date picker
│   │   ├── TimeStep.tsx                time picker
│   │   ├── LineupStep.tsx              activity grid + AI suggestions
│   │   ├── EntreeStep.tsx              food selection
│   │   ├── DressStep.tsx               dress vibe question  ← new
│   │   ├── SummaryStep.tsx             recap + lock it in
│   │   ├── ProgressHearts.tsx          step indicator
│   │   ├── DateAvatar.tsx              corner commentary
│   │   └── [supporting components]
│   ├── sender/
│   │   ├── SenderPlanningView.tsx      full sender UX  ← new
│   │   └── DateMap.tsx                 Leaflet map  ← new
│   ├── SendInviteForm.tsx
│   ├── RatingWidget.tsx
│   └── [auth components]
├── lib/
│   ├── supabase/{client,server,admin,types}.ts
│   ├── email.ts                        Resend — invite + notification emails
│   ├── itinerary.ts                    Gemini itinerary generation
│   ├── mock-venues.ts                  simulated venue data  ← new (replace with Places API)
│   └── [date-options, food-options, share, utils]
├── supabase/schema.sql
└── docs/
    ├── PRODUCT_PLAN.md
    └── PROGRESS.md                     ← this file
```
