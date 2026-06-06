# cutelyask.me — Date Planner Mini-Site

A two-sided "will you go on a date with me?" web app. The sender creates a
personalized invite; the recipient accepts and picks the vibe (date, time,
activities, food, dress code); the sender then picks the real venues, arranges
the stops on a map, sets how long to spend at each, and shares it — with
Google Calendar / `.ics` export.

## How it works

**Recipient flow** (`/invite/[recipient]` → `DatePlanner` wizard)
A personalized ask with a dodging "No" button and confetti, then a wizard:
**date → time → activities → food category → dress vibe → lock it in.** The
recipient picks *what kind* of date — not specific venues.

**Sender flow** (`/plan/[id]` → `SenderPlanningView`)
The sender sees what she chose, then:
- picks the real **venue** for each stop (Yelp for businesses, OpenStreetMap
  for parks / viewpoints / stargazing),
- reorders stops and sets a **duration** for each,
- sees a live **timeline** with per-stop **Google Calendar** links and a
  whole-date **`.ics` download**,
- views every stop on an interactive **Leaflet map** with a drag-to-set
  search-area pin,
- **notifies** the recipient (share the plan, or keep it a surprise).

## Stack

| Concern | Tech |
|---|---|
| Framework | Next.js 16 · React 19 · TypeScript · Tailwind v4 |
| Auth | Clerk (email magic link + Google OAuth) |
| Database | Turso (libSQL/SQLite) + Drizzle ORM |
| Email | Resend |
| AI | Gemini 2.5 Flash — activity ideas + itinerary generation |
| Venues | Yelp Fusion (businesses) · Overpass/OpenStreetMap (natural places) |
| Geocoding | Nominatim (OpenStreetMap) |
| Map | Leaflet + CartoDB Positron tiles |
| Hosting | Vercel |

Every service runs on a free tier — see [`COSTS.md`](./COSTS.md).

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the keys below
npm run dev                  # http://localhost:3000
```

### Required environment variables

| Key | Source |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | clerk.com |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | turso.tech |
| `YELP_API_KEY` | developer.yelp.com |
| `GEMINI_API_KEY` | Google AI Studio |
| `RESEND_API_KEY` | resend.com |
| `NEXT_PUBLIC_SITE_URL` | e.g. `http://localhost:3000` or `https://cutelyask.me` |

The app degrades gracefully when a key is missing: no `GEMINI_API_KEY` skips
AI itineraries/ideas; no `RESEND_API_KEY` skips emails.

### Database schema

Drizzle schema lives in `lib/db/schema.ts`. Push changes to Turso with:

```bash
npx drizzle-kit push
```

## Project layout

See [`docs/PROGRESS.md`](./docs/PROGRESS.md) for the current build status and
next steps, and [`docs/PRODUCT_PLAN.md`](./docs/PRODUCT_PLAN.md) for product
direction.

> **Note for contributors / agents:** this repo runs **Next.js 16**, which has
> breaking changes from older versions. See [`AGENTS.md`](./AGENTS.md).
