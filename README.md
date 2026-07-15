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
- sees a live **timeline** with **Google Routes travel legs** (per-leg drive/walk
  toggle) and a single **Add to calendar** control (Google Calendar or `.ics`,
  one event or one-per-stop),
- views every stop on an interactive **Google map** (click-to-set search
  center, configurable wheel-zoom),
- **notifies** the recipient (share the plan, or keep it a surprise), which confirms and freezes the plan so the shared details cannot drift.

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
| Routing | Google Routes API (travel times, cached) |
| Geocoding | Nominatim (OpenStreetMap) |
| Map | Google Maps JavaScript API |
| Photos | Cloudinary (signed direct uploads) |
| Notifications | Durable Resend email + web-push (VAPID) delivery queue |
| Tests | Vitest (`npm test`) + Playwright (`npm run test:e2e`) |
| Hosting | Vercel |

Every service runs on a free tier — see [`COSTS.md`](./COSTS.md).

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the documented values
npm run db:migrate
npm run dev                  # http://localhost:1437
```

### Environment variables

`.env.example` is the authoritative environment-variable reference, including which values are server-only and which are required for migrations, anonymous plan access, scheduled notification retries, maps, uploads, and optional service integrations.

### Database schema

Drizzle schema lives in `lib/db/schema.ts`, and durable ordered SQL migrations live in `drizzle/`.
Run them with `npm run db:migrate`; existing databases must first provide the exact `LEGACY_PLAN_TIMEZONES` mapping described in `.env.example`.
See "Conventions & gotchas" in [`docs/HANDOFF.md`](./docs/HANDOFF.md) for the migration contract.

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
