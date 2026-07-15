# Product Flow

How cutelyask.me works end-to-end, and the product decisions behind it.
Mobile-first; eventually a native app, so choices favor that runway.

---

## Cast

- **Sender** — the asker. Always signed in (Google).
- **Recipient** — the asked. Can use the whole core flow from a link with **no
  account**; only needs to sign in for the *personalized* extras (my-dates list,
  push notifications, post-date reviews tied to her).

---

## Identity & auth

- **Google sign-in only**, no MFA, for now (Clerk already supports it).
- **Anonymous access is capability-scoped:** invite links and anonymous email notification links redeem the invite token into an HTTP-only capability for exactly one plan.
  Knowing a plan id alone never grants access, and claiming or revoking an invite rotates the capability version.
- **Signing in claims the invite only after a verified invited-email match.**
  Claiming links the plan to that account, unlocks the my-dates view, push notifications, and post-date reviews, and invalidates anonymous access.

---

## The arc (with states)

A plan moves through a lifecycle; some UI is gated on it.

| State | Set when | What unlocks |
|---|---|---|
| `pending` | Sender creates the invite | The ask link |
| `planned` | Recipient finishes the vibe wizard | Sender can pick venues |
| `confirmed` | **Sender hits Share/Surprise** (`confirmedAt`) | Frozen shared details and post-date reviews/verdicts/keepsake |
| `completed` | The date's `selectedDate` has passed | (future) "how did it go" nudge |

1. **Sign in** (sender) — `/login`.
2. **Create invite** — `/send`: name, email, location (+ avatar). Writes
   `invites`, emails the link via Resend. `/dashboard` tracks status.
3. **The ask** — `/invite/[recipient]`: playful ask, dodging "No", confetti.
4. **Vibe wizard** (recipient, `DatePlanner`) — date → time → activities (budget
   filter + optional Gemini "Ask AI") → food → dress vibe → lock it in.
   `POST /api/plans` creates `date_plans`, generates a first itinerary, emails
   the sender.
5. **Sender builds it** — `/plan/[id]` → `SenderPlanningView`: per-stop venue
   search (Yelp + Overpass), radius/price filters, reorder, durations, "💘 Places
   you loved", timeline + Google Calendar/.ics, map pin. Saving re-generates the
   itinerary with the real venues. **Share plan** (reveal) or **Surprise her**
   (secret) → this marks the plan **confirmed** and permanently freezes its venue, stop, timing, and itinerary details.
6. **Shared plan** — recipient sees the finalized itinerary.
7. **The date happens** — offline.
8. **The memory** (only after `confirmed`, both participants, signed in):
   ⭐ rating · 💘 verdicts · 💌 keepsake (poem + photos).
9. **Next time** — liked spots recommend themselves; Reminisce mode rebuilds a
   date from favorites.

---

## Notifications

No SMS. Two tracks, by whether the recipient signs in.

### Track A — anonymous (sender is the notifier)
The recipient never logs in.
She opens the original invite or notification link, which redeems the invite token into a plan-scoped browser capability, and can revisit the stable plan URL from that browser while the capability remains valid.
The sender can re-share through the notification action.

### Track B — signed-in (self-notifying)
She signs in with the verified invited email → the date is hers → she gets notified automatically.

**Channel: Web Push via PWA** (the chosen mechanism)
- She installs the site to her home screen and allows notifications → we can
  push even when the app is closed.
- **Android:** works in the browser / installed PWA.
- **iPhone:** works **only when installed to the Home Screen** (iOS 16.4+).
- Free, no third party. Needs: a service worker, VAPID keys, a stored push
  subscription per user, and a server send (e.g. the `web-push` library).
- **Email stays the fallback** for anyone not opted into push.
- Email and push jobs use a durable idempotent outbox.
  The request attempts immediate delivery, while the authenticated scheduled worker retries transient failures without duplicating a logical delivery.

**Considered and deferred:** WhatsApp Cloud API and Messenger bots are real APIs
but are business-platform products — Meta Business account, template approval,
24h messaging windows, per-conversation billing. Too heavy for now; revisit only
if Web Push proves insufficient.

---

## Reviews / verdicts (the "would we go back?" loop)

- **Gated on `confirmed`, date completion, and claimed participation** - only the sender or verified-email recipient can review after the timezone-aware date end.
  Confirmation freezes plan editing, while cancellation remains a separate sender action.
- **Three states, neutral by default:**
  - 😐 **neutral** — didn't go / it was closed / nothing to say (the safe default)
  - 👍 **liked** → enters the **Reminisce** pile (recommended next time)
  - 👎 **disliked** → never recommend again
- **"It was closed" path (later):** from a neutral/closed mark, offer
  "find something closer" (nearest in walking range). Realistically people will
  just Google it, so this is a nice-to-have, not core.

---

## Build implications (not yet done)

- [x] **PWA + Web Push** — manifest (`app/manifest.ts`), service worker
      (`public/sw.js`), VAPID keys, `push_subscriptions` table,
      `EnableNotifications` on the dashboard, push sent to the recipient from the
      notify route. (iOS requires Add-to-Home-Screen first.)
- [x] **Claim-on-login** — recipient's plan is claimed by email-match (on plan
      view), and the dashboard shows a "Dates you're invited to" section.
- [x] **`confirmedAt`** on `date_plans`, set by the notify action; post-date
      review + keepsake UI is gated on it.
- [x] **Three-state verdicts** — `venue_verdicts.status`
      (`liked` | `disliked` | `neutral`, neutral default); only `liked` feeds
      "Places you loved" / Reminisce.
- [x] **Reminisce mode** — in-planner panel of liked spots; "Use for [activity]"
      assigns a favorite to a matching stop.
- [x] Mobile pass on the sender planner — columns stack, map shorter + non-sticky
      on mobile, duration/filter pills wrap, responsive padding/headings.
