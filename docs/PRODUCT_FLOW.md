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
- **Links are public-ish:** a plan lives at a stable URL the recipient can
  bookmark and revisit. The event **exists independently of her account**.
- **Signing in claims the invite** to her account → unlocks the my-dates view,
  push notifications, and her own post-date reviews.

---

## The arc (with states)

A plan moves through a lifecycle; some UI is gated on it.

| State | Set when | What unlocks |
|---|---|---|
| `pending` | Sender creates the invite | The ask link |
| `planned` | Recipient finishes the vibe wizard | Sender can pick venues |
| `confirmed` | **Sender locks venues + hits Share/Surprise** (`confirmedAt`) | **Reviews/verdicts + keepsake** |
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
   (secret) → this marks the plan **confirmed**.
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
The recipient never logs in. The sender shares the link (text, etc.) and
re-shares to "notify." The plan URL is stable; she checks back whenever.

### Track B — signed-in (self-notifying)
She signs in → the date is hers → she gets notified automatically.

**Channel: Web Push via PWA** (the chosen mechanism)
- She installs the site to her home screen and allows notifications → we can
  push even when the app is closed.
- **Android:** works in the browser / installed PWA.
- **iPhone:** works **only when installed to the Home Screen** (iOS 16.4+).
- Free, no third party. Needs: a service worker, VAPID keys, a stored push
  subscription per user, and a server send (e.g. the `web-push` library).
- **Email stays the fallback** for anyone not opted into push.

**Considered and deferred:** WhatsApp Cloud API and Messenger bots are real APIs
but are business-platform products — Meta Business account, template approval,
24h messaging windows, per-conversation billing. Too heavy for now; revisit only
if Web Push proves insufficient.

---

## Reviews / verdicts (the "would we go back?" loop)

- **Gated on `confirmed`** — you can only review a place once the venues are
  locked and the date is set. Reviewing is independent of editing/canceling the
  plan (only the sender edits the plan, separately).
- **Three states, neutral by default:**
  - 😐 **neutral** — didn't go / it was closed / nothing to say (the safe default)
  - 👍 **liked** → enters the **Reminisce** pile (recommended next time)
  - 👎 **disliked** → never recommend again
- **"It was closed" path (later):** from a neutral/closed mark, offer
  "find something closer" (nearest in walking range). Realistically people will
  just Google it, so this is a nice-to-have, not core.

---

## Build implications (not yet done)

- [ ] **PWA + Web Push** — manifest, service worker, install prompt, VAPID keys,
      `push_subscriptions` table, send on plan-confirmed/updated.
- [ ] **Claim-on-login** — when a recipient signs in via an invite, attach the
      plan to her `recipientId`; add a recipient "my dates" view.
- [x] **`confirmedAt`** on `date_plans`, set by the notify action; post-date
      review + keepsake UI is gated on it.
- [x] **Three-state verdicts** — `venue_verdicts.status`
      (`liked` | `disliked` | `neutral`, neutral default); only `liked` feeds
      "Places you loved" / Reminisce.
- [x] **Reminisce mode** — in-planner panel of liked spots; "Use for [activity]"
      assigns a favorite to a matching stop.
- [ ] Mobile-first passes on the existing screens (sender planner is desktop-ish).
