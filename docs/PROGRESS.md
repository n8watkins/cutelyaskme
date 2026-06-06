# Progress & Next Steps

_Last updated: June 2026_

---

## What's Built

### Infrastructure

| | |
|---|---|
| Framework | Next.js 16, React 19, TypeScript, Tailwind v4 |
| Auth | Clerk — email + Google OAuth, embedded `<SignIn />` |
| Database | Turso (libSQL/SQLite) — Drizzle ORM, schema-pushed |
| Email | Resend — invite emails + sender notification on plan submission |
| AI | Gemini 2.5 Flash — activity suggestions + itinerary generation |
| Map | Leaflet / OpenStreetMap — no API key, free |
| Deployment | Vercel — (pending redeploy with new env vars) |
| Domain | cutelyask.me (purchased, not yet connected) |

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
| Planning view | `/plan/[id]` as sender → her picks + venue picker + map + route builder |
| Notification | Email from Resend when she locks in the plan |

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
invites      — id, token (unique), sender_id, recipient_name, recipient_email, status, created_at
date_plans   — id, invite_id, sender_id, recipient_id, date/time/entree/activities (JSON), itinerary (JSON), dress_vibe, completed_at
date_ratings — id, plan_id, rater_id, score (CHECK 1–5), note, UNIQUE(plan_id, rater_id)
```

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

### Short term — real venue data

- [ ] **Google Places API** — replace `lib/mock-venues.ts` with real API calls
  - Add `GOOGLE_PLACES_API_KEY` env var
  - Add `location` field to invite creation form (`/send`) + `invites` DB table
  - Create `/api/places` route: Google Places Text Search → cache in Turso `place_cache` table (24h TTL)
  - `getVenuesForFood()` and `getVenuesForActivity()` call the API instead of returning mock data
  - Map pins use real coordinates from Places results

- [ ] **Finalize action persists** — "Surprise her" / "Send the deets" currently shows a success screen but doesn't write to DB or send email
  - Add `finalized_at`, `sender_venues` (JSON), `surprise_mode`, `dress_code_message` columns to `date_plans`
  - `/api/plans/[id]/finalize` PATCH endpoint
  - Resend email for each mode

### Medium term — polish

- [ ] Custom domain fully live (cutelyask.me → Vercel)
- [ ] OG image for invite links (Satori / @vercel/og)
- [ ] Mobile map layout — map as toggleable drawer on mobile
- [ ] Invite resend / cancel buttons on dashboard
- [ ] Google Calendar `.ics` export — "Add to my calendar"
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
│   │       ├── plans/route.ts               submit plan + generate itinerary
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
│   ├── email.ts                             Resend emails
│   ├── itinerary.ts                         Gemini itinerary generation
│   ├── mock-venues.ts                       simulated venue data (replace with Places API)
│   └── [date-options, food-options, etc]
├── drizzle.config.ts
└── docs/
    ├── PRODUCT_PLAN.md
    └── PROGRESS.md                          ← this file
```
