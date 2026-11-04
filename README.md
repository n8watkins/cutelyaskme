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
| Hosting | Cloudflare Workers via OpenNext (Vercel until the domain cutover) |

Every service runs on a free tier — see [`COSTS.md`](./COSTS.md).

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the documented values
npm run db:migrate
npm run dev                  # http://localhost:1437
```

### Environment variables

`.env.example` is the authoritative environment-variable reference, including which values are server-only and which are required for migrations, anonymous plan access, notification recovery, maps, uploads, and optional service integrations.

Notification email and push work is stored in an idempotent database outbox.
A queue provides prompt delivery and delayed retries, while a once-daily cron run reconciles any work missed during a database-to-queue handoff.
On Cloudflare that is the `cutelyaskme-notification-delivery` queue and a Cron Trigger (see Hosting); the Vercel deployment uses Vercel Queue and Vercel Cron until it is retired.

### Hosting

The app runs on Cloudflare Workers, built with [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare), at https://cutelyaskme.nathancwatkins23.workers.dev until a custom domain is chosen.
[`wrangler.jsonc`](./wrangler.jsonc) holds the Worker config: bindings, the queue consumer, the daily Cron Trigger, plain variables and the list of required secrets.
[`worker/index.ts`](./worker/index.ts) is the entry point.
It serves the Next.js app and adds the queue and cron handlers from [`worker/handlers.ts`](./worker/handlers.ts), which call `/api/notifications/process` in-process with `CRON_SECRET`.
A failed drain is retried after 120 seconds, and after 10 attempts the message moves to `cutelyaskme-notification-delivery-dlq`; the outbox rows stay in the database either way, so the daily run still picks them up.

```bash
npm run build:worker     # OpenNext build into .open-next/
npm run preview:worker   # build, then serve it locally in workerd (reads .dev.vars)
npm run deploy:worker    # build, then deploy
npm run cf-typegen       # regenerate cloudflare-env.d.ts after changing wrangler.jsonc
```

Pushes to `main` deploy on their own: [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) builds and deploys the commit once CI passes on it, using the `CLOUDFLARE_API_TOKEN` repository secret.
`NEXT_PUBLIC_*` values are inlined by `next build`, so a deploy build needs them in its environment: GitHub repository variables for the Deploy workflow, the shell for a manual deploy.
Keep `.env*` files with secrets out of the working tree when building for a deploy: OpenNext copies Next.js `.env` files into the Worker bundle.
Server secrets live in Worker secrets (`wrangler secret put NAME`); local workerd runs read them from `.dev.vars`.
`PLAYWRIGHT_BASE_URL=<url>` runs the end-to-end suite against a running deployment instead of a local build (see [`playwright.config.ts`](./playwright.config.ts)).

### Reading the logs

Workers Logs keeps every request (`observability` in `wrangler.jsonc`, `head_sampling_rate: 1`).
In the Cloudflare dashboard, open Workers & Pages, then the `cutelyaskme` Worker, then Logs.
To stream them live, run `npx wrangler tail cutelyaskme --format pretty`.
`--search` matches log messages only, not request URLs, so use `--status error` or no filter to see requests.
Failures log one JSON line with `event`, `reason` and `route`: `notification_delivery_failed` per failed job (kind, channel, attempt, and `retry` or `exhausted`), `clerk_lookup_failed` with Clerk's HTTP status, `notification_queue_drain_failed` with the batch's attempt and retry delay, `notification_reconciliation_failed` for the daily cron, and `unhandled_exception` with the route for errors thrown in pages, route handlers or the proxy (`src/instrumentation.ts`).
They never carry secrets, tokens, cookies, emails or other personal data; error messages are masked.

### Tests and CI

```bash
npm run lint && npm run typecheck && npm test   # ESLint, TypeScript, Vitest
npm run build && npm run size                   # production build, then first-load JS per page vs bundle-budget.json
npm run test:e2e:install                        # once: Chromium and WebKit for Playwright
npm run test:e2e                                # Playwright, including axe accessibility checks
PLAYWRIGHT_PORT=1447 npm run test:e2e           # the same, beside a dev server on 1437
```

The end-to-end suite builds the app and runs `next start` against a fresh SQLite file (`.playwright-e2e.db`) with placeholder Clerk keys.
It needs no real credentials: no email, push, maps, Places, Gemini or Cloudinary call is made, so every test runs in CI and none is skipped.
Pages behind sign-in are not covered end to end yet, because the placeholder Clerk keys cannot sign anyone in.

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on GitHub-hosted runners for every pull request and every push to `main`.
Lint, types, unit tests (plus migrations against an empty database), the build with its bundle-size check, and the Worker build (binding types, OpenNext build and a dry-run bundle) run as parallel jobs, and Playwright runs once per browser engine (Chromium desktop and mobile, WebKit mobile).
A docs-only change skips them, and a dev-dependency-only change skips the end-to-end jobs (see release-kit's CI lanes).
`CI result` is the one required check.
The release-kit workflows also check every commit message and pull request title (`Commit messages`) and scan the lock file with OSV (`Security scan`, weekly and when the lock file changes).

### Releases

Commits follow Conventional Commits, and [release-kit](https://github.com/n8watkins/release-kit) turns them into versions, `CHANGELOG.md` and GitHub Releases.
See [`RELEASING.md`](./RELEASING.md).

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
