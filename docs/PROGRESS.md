# Progress & Next Steps

> **⚠️ Historical snapshot** (June 2026, post venue-architecture migration —
> pre-PLANNER_V2). Everything below still shipped, but a lot more has landed
> since: the full PLANNER_V2 roadmap (planner UX, settings, post-date
> lifecycle, keepsake card) is done — see the status table in
> [`PLANNER_V2.md`](PLANNER_V2.md) and current state in
> [`../TODO.md`](../TODO.md). Kept for history; not maintained.

---

## What's Built

### Infrastructure

| | |
|---|---|
| Framework | Next.js 16, React 19, TypeScript, Tailwind v4 |
| Auth | Clerk — email + Google OAuth, embedded `<SignIn />` |
| Database | Turso (libSQL/SQLite) — Drizzle ORM, schema-pushed |
| Email | Resend — invite emails + sender notification on plan submission |
| AI | Gemini 3.1 Flash Lite — activity suggestions + itinerary generation |
| Venues | Yelp Fusion (businesses) + Overpass/OpenStreetMap (parks, viewpoints, stargazing) — 24h DB cache |
| Geocoding | Nominatim (OpenStreetMap) — no API key |
| Map | Leaflet / OpenStreetMap — no API key, free |
| Deployment | Vercel — live at date-planner-mini-site.vercel.app |
| Domain | cutelyask.me — **not yet registered** (verified June 11, 2026; see [`LAUNCH.md`](LAUNCH.md)) |

---

### Her Flow (recipient)

| Step | What happens |
|---|---|
| Invite | Personalized ask with evasive "No" button, confetti on accept |
| Date | Calendar picker with quick-select suggestions |
| Time | Preset time cards + custom time picker |
| Activities | Grid of time-filtered options, budget vibe filter, ⭐ "Ask AI" section |
| Food | Food category selection |
| Dress vibe | Casual / casual-cute / dress up / match whatever |
| Summary | Full recap, editable, "Lock it in" button |
| **Confirmed** _(new)_ | Celebration screen with confetti, links to plan + dashboard |

---

### Your Flow (sender)

| Feature | Where |
|---|---|
| Sign in | `/login` — Clerk embedded UI (email magic link + Google OAuth) |
| Create invite | `/send` — name + email → invite created in DB, email sent via Resend |
| Dashboard | `/dashboard` — all sent invites with status badges |
| Pending invite | "Preview →" opens invite link + "Copy link" button |
| Completed invite | "View plan →" links to full sender planning view |
| Planning view | `/plan/[id]` as sender → her picks + per-stop venue picker + map + route builder |
| Venue picker | Yelp/Overpass results per stop, price + radius filters, reorder stops, pick spot |
| Durations | Per-stop time selector (30m–3h) drives a computed timeline |
| Calendar export | Per-stop "Add to Google Calendar" links + whole-date `.ics` download |
| Map pin | Drag-to-set search center with radius circle (Nominatim reverse-geocode) |
| Notification | Email when she locks in the plan; sender can "Share plan" or "Surprise her" |

---

### Security & Data

| | |
|---|---|
| Plan access | Logged-in non-participants get 404; anonymous users can view |
| Ratings | Atomic upsert (no race condition), DB CHECK constraint on score 1–5 |
| JSON fields | Safe parse with fallback on `selectedActivities` and `itinerary` |
| Invite query | Skips DB lookup when inviteId is null |
| DB constraints | UNIQUE(planId, raterId) on ratings table |

---

### Database Schema

```
invites      — id, token (unique), sender_id, recipient_name, recipient_email,
               location, sender_avatar_src, status, created_at
date_plans   — id, invite_id, sender_id, recipient_id,
               date/time/entree/activities (JSON), dress_vibe,
               selected_entree_venue (JSON), selected_activity_venues (JSON),  ← sender's picks
               itinerary (JSON), itinerary_generated_at, completed_at, created_at
date_ratings — id, plan_id, rater_id, score (CHECK 1–5), note, UNIQUE(plan_id, rater_id)
place_cache  — id, cache_key (unique), results (JSON), expires_at   ← Yelp/Overpass 24h cache
```

> **Venue architecture:** the recipient picks *categories* (food type, activity
> labels). The **sender** picks the specific venues on `/plan/[id]`, stored in
> `selected_entree_venue` / `selected_activity_venues` via `PATCH /api/plans/[id]`.

---

## What Needs External Setup

| Service | Status | Env var |
|---|---|---|
| Turso | ✅ Connected | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` |
| Clerk | ✅ Connected | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
| Resend | ⬜ Needs API key | `RESEND_API_KEY` |
| Gemini | ⬜ Needs API key | `GEMINI_API_KEY` |
| Vercel | ⬜ Needs env vars + redeploy | `NEXT_PUBLIC_SITE_URL=https://cutelyask.me` |
| cutelyask.me | ⬜ Purchased, not connected to Vercel | — |

---

## Next Steps

### Immediate — get to fully working end-to-end

- [ ] **Resend API key** — add to `.env.local` + Vercel env vars so invite + notification emails send
- [ ] **Gemini API key** — add to `.env.local` + Vercel env vars so AI suggestions + itinerary generation work
- [ ] **Vercel redeploy** — push to GitHub, add all env vars in Vercel dashboard, redeploy
- [ ] **Connect cutelyask.me** — point domain DNS to Vercel, update `NEXT_PUBLIC_SITE_URL`

### Done since last update ✅

- [x] **Real venue data** — Yelp Fusion (`/api/places`) for businesses +
  Overpass/OSM (`/api/natural-places`) for parks/viewpoints/stargazing, both
  cached 24h in `place_cache`. `lib/mock-venues.ts` retired.
- [x] **Venues persisted** — sender's picks stored in `date_plans` via
  `PATCH /api/plans/[id]`; `DateMap` shows real pins.
- [x] **Per-stop durations + timeline** with Google Calendar links and `.ics` export.
- [x] **Notify on lock-in** — `POST /api/plans/[id]/notify` sends share/surprise email.

### Short term

- [ ] **Store hours on venue cards** — surface Yelp business hours / open-now badge.
- [ ] **"Surprise ending" sender flow** — let the sender pick a secret final stop.
- [ ] **Session-expiry UX** — `/api/places` 401 mid-wizard should prompt re-login
  instead of showing "no venues found".

### Medium term — polish

- [ ] Custom domain fully live (cutelyask.me → Vercel)
- [ ] OG image for invite links (Satori / @vercel/og)
- [ ] Mobile map layout — map as toggleable drawer on mobile
- [ ] Invite resend / cancel buttons on dashboard
- [ ] Post-date memory — rating + short note + photos in Turso/Storage

### Long term — public product

1. ToS + privacy policy
2. Google OAuth app verification (required past 100 users)
3. Stripe subscription (free = 3 invites, paid = unlimited)
4. Persistent rate limiting (move from in-memory Map to Turso)
5. Edge-level rate limiting via Vercel middleware

---

## File Map

```
date-planner-mini-site/
├── src/
│   ├── app/
│   │   ├── page.tsx                         landing / redirect to dashboard
│   │   ├── login/[[...sign-in]]/page.tsx    Clerk embedded sign-in
│   │   ├── send/page.tsx                    create invite
│   │   ├── dashboard/page.tsx               sent invites + past dates
│   │   ├── invite/[recipient]/page.tsx      token or name-based invite route
│   │   ├── plan/[id]/page.tsx               role-aware: sender → planning view, recipient → itinerary
│   │   └── api/
│   │       ├── date-ideas/route.ts          Gemini activity suggestions (cached)
│   │       ├── invites/route.ts             create invite + list sender's invites
│   │       ├── places/route.ts              Yelp Fusion venue search (24h cache)
│   │       ├── natural-places/route.ts      Overpass/OSM parks·viewpoints·stargazing
│   │       ├── plans/route.ts               submit plan + generate itinerary
│   │       ├── plans/[id]/route.ts          PATCH sender's venue picks + stop order
│   │       ├── plans/[id]/notify/route.ts   email recipient (share / surprise)
│   │       └── ratings/route.ts             upsert star rating (atomic)
│   └── middleware.ts                        Clerk auth guard
├── components/
│   ├── CopyLinkButton.tsx                   client component for clipboard
│   ├── RatingWidget.tsx
│   ├── SendInviteForm.tsx
│   ├── date-planner/
│   │   ├── DatePlanner.tsx                  main wizard state machine
│   │   ├── ConfirmedStep.tsx                post-submit celebration  ← new
│   │   ├── [all other wizard steps]
│   └── sender/
│       ├── SenderPlanningView.tsx           full sender UX
│       └── DateMap.tsx                      Leaflet map
├── lib/
│   ├── db/
│   │   ├── index.ts                         Turso + Drizzle client
│   │   └── schema.ts                        Drizzle schema + types
│   ├── email.ts                             Resend emails (invite, notify, spot-ready)
│   ├── itinerary.ts                         Gemini itinerary generation
│   ├── venues.ts                            Venue type, activity→query maps, durations
│   └── [date-options, food-options, etc]
├── drizzle.config.ts
└── docs/
    ├── PRODUCT_PLAN.md
    └── PROGRESS.md                          ← this file
```
