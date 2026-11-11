# Cost Breakdown

All pricing as of June 2026. This is a personal-scale app — estimates assume a few dozen uses/month.

---

## Always Free

### Vercel — Hosting
- Serverless functions, static assets, CDN, automatic SSL
- 100 GB bandwidth/month on Hobby plan — more than enough

### Turso — Database
- 500 databases, 9 GB storage, 1 billion row reads/month
- Free tier covers personal use indefinitely

### Clerk — Authentication
- 10,000 monthly active users free
- Unlimited sign-ins, social OAuth, email magic links

### Resend — Email
- 3,000 emails/month, 100/day free
- Sends invite + plan-confirmed emails

### Google Places API (New) — Venue search
- Free tier is **per SKU, per month** (the old $200/mo credit was retired March 2025):
  - Text Search (Pro fields: name, address, rating, price level, coords): 5,000/mo
  - Place Details with reviews (Enterprise + Atmosphere): 1,000/mo
  - Photo media: 1,000/mo ($7/1k after) - one photo per venue per search page, watch this one
- Requires a Google Cloud billing account (credit card on file) — set quota
  caps in the console so it can never actually charge
- Searches are explicit per-stop actions (zero calls on page load); results
  cached in the DB (details 7 days, 30 once a place is 👍-liked)
- A daily usage meter lives in `/settings` ("Google Places: N calls today")
- Review excerpts and hours come from a single details call; "powered by
  Google" attribution shown wherever Places data renders

### Gemini 3.1 Flash Lite — itinerary notes, activity ideas, memory poems
- 1,500 free requests/day, 15/minute
- Personal use never exceeds this

### Cloudinary — memory photos
- ~25 free credits/month (1 credit ≈ 1 GB storage / 1 GB bandwidth / 1k
  transforms, shared) with built-in resize/optimize/CDN
- Signed direct uploads from the browser; assets are destroyed when removed
  from a gallery, so storage doesn't accumulate orphans

### Google Routes API — travel times between stops
- `computeRoutes` on the **Essentials SKU**: 10,000 free calls/month.
- The field mask requests only `routes.duration` + `routes.distanceMeters`, and traffic-aware routing, waypoint optimization, and location modifiers are never enabled - any of those would move calls to a pricier SKU.
- One call per drive leg; legs under 0.8 mi add one walk-mode call.
- Uses the same server key as Places (`GOOGLE_PLACES_API_KEY`, Routes API enabled on the project).
- Results cached 30 days in the DB; haversine fallback if unreachable.

### Map display — Google Maps JavaScript API
- 10,000 free map loads/month (Essentials SKU), then ~$7/1k
- Browser key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) restricted to this API +
  site referrers; quota caps make overage impossible
- Also satisfies Google's terms for showing Places data on a Google map

### Geocoding — Nominatim + Overpass
- Nominatim geocoding + Overpass natural-place search: free, server-side,
  cached, with a proper User-Agent

### web-push — date notifications
- Self-generated VAPID keys, browser push infrastructure is free

---

## Total monthly cost: $0

Every component in this app has a free tier that comfortably covers personal use.

---

## Required API Keys

| Key | Where to get | Cost |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | console.cloud.google.com | Free (billing account required) |
| `GEMINI_API_KEY` | Google AI Studio | Free |
| `CLERK_*` keys | clerk.com | Free |
| Cloudflare Email Service | `send_email` binding, no key | Included with Workers Paid (3,000/mo) |
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | turso.tech | Free |
| `CLOUDINARY_*` keys | cloudinary.com | Free |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | console.cloud.google.com | Free (10k loads/mo) |
| `VAPID_*` keys | `npx web-push generate-vapid-keys` | Free |

The only real launch cost is the **cutelyask.me domain registration**
(~$10–25/yr, not yet purchased).

