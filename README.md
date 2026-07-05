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
- picks the real **venue** for each stop (Google Places for businesses on explicit
  per-stop searches, OpenStreetMap for parks / viewpoints / stargazing, or a
  hand-dropped **custom pin**), with hours/open-during-date badges and
  per-stop price filters,
- reorders stops (with **sunset-aware** suggestions and a pinned sun strip)
  and sets a **duration** for each,
- sees a live **timeline** with **OSRM travel legs** (per-leg drive/walk
  toggle) and a single **Add to calendar** control (Google Calendar or `.ics`,
  one event or one-per-stop),
- views every stop on an interactive **Google map** (click-to-set search
  center, configurable wheel-zoom),
- **notifies** the recipient (share the plan, or keep it a surprise).

**After the date** — ratings, per-venue 👍/😐/👎 verdicts (which power
"Places you loved" + Reminisce mode next time), and a **memory keepsake**:
notes → a Gemini poem + Cloudinary photos, presented at `/plan/[id]/memory`
as an animated card (slideshow, drifting hearts, tap-to-play music) with an
optional public share link. Past dates turn read-only; dates can be canceled
gracefully. Per-user defaults live at `/settings`.

## Stack

| Concern | Tech |
|---|---|
| Framework | Next.js 16 · React 19 · TypeScript · Tailwind v4 |
| Auth | Clerk (email magic link + Google OAuth) |
| Database | Turso (libSQL/SQLite) + Drizzle ORM |
| Email | Resend |
| AI | Gemini 3.1 Flash Lite — activity ideas, itinerary notes/tips, memory poems |
| Venues | Google Places API (New) (businesses) · Overpass/OpenStreetMap (natural places) |
| Routing | OSRM public server (travel times, cached) |
| Geocoding | Nominatim (OpenStreetMap) |
| Map | Google Maps JavaScript API |
| Photos | Cloudinary (signed direct uploads) |
| Notifications | web-push (VAPID) |
| Tests | Vitest (`npm test`) over the pure `lib/*` helpers |
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
| `GOOGLE_PLACES_API_KEY` | console.cloud.google.com |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | console.cloud.google.com (browser Maps key + optional Map ID) |
| `STATIC_MAPS_SIGNING_SECRET` | console.cloud.google.com (Maps URL signing secret - signs the static map images embedded in emails) |
| `GEMINI_API_KEY` | Google AI Studio |
| `RESEND_API_KEY`, `EMAIL_FROM` | resend.com |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | cloudinary.com (memory photos) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `npx web-push generate-vapid-keys` |
| `NEXT_PUBLIC_SITE_URL` | e.g. `http://localhost:3000` or `https://cutelyask.me` |

The app degrades gracefully when a key is missing: no `GEMINI_API_KEY` skips
AI itineraries/ideas; no `RESEND_API_KEY` skips emails.
No `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` skips maps and static route snapshots.
No `STATIC_MAPS_SIGNING_SECRET` skips only the map images inside emails.

### Database schema

Drizzle schema lives in `lib/db/schema.ts`, but there is **no drizzle-kit
flow** for migrations: edit the schema, then run a temp `migrate-tmp.mjs` in
the repo root with raw SQL via `@libsql/client` (see "Conventions & gotchas"
in [`docs/HANDOFF.md`](./docs/HANDOFF.md)).

## Project status & docs

- [`TODO.md`](./TODO.md) — what's open (launch) and what shipped.
- [`docs/PLANNER_V2.md`](./docs/PLANNER_V2.md) — the June 2026 roadmap, fully
  shipped; status table with commit hashes at the bottom.
- [`docs/HANDOFF.md`](./docs/HANDOFF.md) — orchestrator playbook, conventions,
  file map.
- [`docs/LAUNCH.md`](./docs/LAUNCH.md) — the remaining go-live steps
  (domain, Resend, Clerk production).
- [`docs/PRODUCT_FLOW.md`](./docs/PRODUCT_FLOW.md) /
  [`docs/PRODUCT_PLAN.md`](./docs/PRODUCT_PLAN.md) — product decisions and
  direction.

> **Note for contributors / agents:** this repo runs **Next.js 16**, which has
> breaking changes from older versions. See [`AGENTS.md`](./AGENTS.md).
