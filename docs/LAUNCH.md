# Launch Checklist

Everything code-side is done. These steps are purchase/dashboard/DNS work only —
they make the app run on **cutelyask.me**, email the recipient (not just you),
and use a real Clerk auth instance.

## 0. Buy cutelyask.me (verified NOT registered as of June 11, 2026)

The domain is **not currently registered** (checked via the .me registry RDAP
and public DNS — both NXDOMAIN). Nothing below can start without it.

- **Easiest path: buy through Vercel** (`npx vercel domains buy cutelyask.me`
  or dashboard → Domains). Vercel then hosts the DNS zone, step 1 collapses to
  almost nothing, and the Resend/Clerk records in steps 2–3 can be added via
  `npx vercel dns add` instead of a registrar UI.
- Or buy at any registrar (Namecheap, Porkbun, …) — cheaper sometimes, but
  every DNS record below is then manual in that registrar's dashboard.

Do the remaining steps in order. They all add DNS records for cutelyask.me,
so keep your DNS tab open throughout.

Current state to change:
| Env var (Vercel + `.env.local`) | Now | After launch |
|---|---|---|
| `EMAIL_FROM` | `Date Night <onboarding@resend.dev>` | `Date Night <invites@cutelyask.me>` |
| `NEXT_PUBLIC_SITE_URL` | `https://date-planner-mini-site.vercel.app` | `https://cutelyask.me` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | `pk_test…` / `sk_test…` | `pk_live…` / `sk_live…` |

---

## 1. Connect cutelyask.me to Vercel

1. [Vercel dashboard](https://vercel.com/natkins23s-projects/date-planner-mini-site) → **Settings → Domains → Add** → type `cutelyask.me`.
2. Vercel shows DNS records. Add them at your registrar:
   - **Apex** (`cutelyask.me`): an **A record** → `76.76.21.21`
   - **www**: a **CNAME** → `cname.vercel-dns.com`
   - (Or, if you prefer, switch the domain's nameservers to Vercel's — Vercel will offer this.)
3. Wait for Vercel to show **"Valid Configuration"** (minutes to ~1 hr for DNS).
4. Update the env var + redeploy:
   ```bash
   # in the project dir
   printf 'https://cutelyask.me' | npx vercel env add NEXT_PUBLIC_SITE_URL production --force
   npx vercel deploy --prod --yes
   ```
   (Also set it in `.env.local` for local dev.)

**Verify:** `curl -I https://cutelyask.me` returns `200`.

---

> Update: email now goes through Cloudflare Email Service from `cutelyaskme@n8builds.dev`, so the Resend steps below no longer apply.

## 2. Verify cutelyask.me in Resend (so emails reach HER)

Right now `EMAIL_FROM` is Resend's shared `onboarding@resend.dev`, which **only
delivers to your own Resend account email**. To email invitees, verify your domain.

1. [Resend dashboard](https://resend.com/domains) → **Domains → Add Domain** →
   enter `cutelyask.me` (Resend may suggest a `send.` subdomain — that's fine and
   avoids clashing with any apex MX).
2. Resend shows ~3 records — add them at your registrar:
   - **MX** record (for the sending subdomain)
   - **SPF** — a `TXT` with `v=spf1 include:amazonses.com ~all`
   - **DKIM** — a `TXT` (long key) Resend generates
   - (optional) **DMARC** `TXT`
3. Back in Resend, click **Verify** until all rows are green (DNS can take a bit).
4. Point the app at it + redeploy:
   ```bash
   printf 'Date Night <invites@cutelyask.me>' | npx vercel env add EMAIL_FROM production --force
   npx vercel deploy --prod --yes
   ```
   (Match the subdomain you verified, e.g. `invites@send.cutelyask.me`. Also update `.env.local`.)

**Verify:** create an invite to a *different* email address and confirm it arrives.

---

## 3. Move Clerk to a production instance

You're on Clerk **test keys** (`pk_test…`), which use Clerk's shared dev Google
OAuth and show a "development" banner. Production needs your own instance.

1. [Clerk dashboard](https://dashboard.clerk.com) → your app → **top-left
   instance switcher → Production** (Clerk walks you through "Deploy to production").
2. **Set the domain** to `cutelyask.me`. Clerk gives you **CNAME records**
   (e.g. `clerk`, `accounts`, `clkmail`, `clk._domainkey…`) — add them all at your registrar.
3. **Google OAuth:** the prod instance needs *your own* Google credentials
   (the dev shared ones don't carry over):
   - [Google Cloud Console](https://console.cloud.google.com/apis/credentials) →
     **Create OAuth client ID** (Web application).
   - Authorized redirect URI: the **callback URL Clerk shows** on its Google
     connection page (looks like `https://accounts.cutelyask.me/v1/oauth_callback`).
   - Paste the Google **Client ID + Secret** into Clerk's Google SSO connection.
4. Copy the **production API keys** from Clerk (**API Keys** page → `pk_live…`,
   `sk_live…`) and set them + redeploy:
   ```bash
   printf 'pk_live_xxx' | npx vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production --force
   printf 'sk_live_xxx' | npx vercel env add CLERK_SECRET_KEY production --force
   npx vercel deploy --prod --yes
   ```
   (Update `.env.local` too if you want local to use prod auth — usually keep test keys locally.)

**Verify:** sign in at `https://cutelyask.me/login` with Google — no "development" banner.

---

## After all three

- Final redeploy (if you haven't): `npx vercel deploy --prod --yes`
- Smoke test the full loop on the real domain: create invite → email arrives →
  recipient opens link (no login needed) → does the wizard → you plan venues →
  Share → she gets the email/push.
- Optional niceties: a DMARC record, and a Clerk-configured `support@cutelyask.me`.

DNS gotcha: Resend (MX/TXT on a send-subdomain), Vercel (A/CNAME on apex/www),
and Clerk (CNAMEs on clerk/accounts subdomains) all coexist — they use different
record names, so there's no conflict as long as you don't double up the apex.
