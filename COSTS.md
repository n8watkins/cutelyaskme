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

### Yelp Fusion API — Venue search
- 500 API calls/day free, no credit card required
- Returns name, address, rating (1–5 stars), price level ($–$$$$), coordinates
- Searches are explicit per-stop actions (zero calls on page load); results
  cached in the DB (details 7 days, 30 once a place is 👍-liked)
- A daily usage meter lives in `/settings` ("Yelp: N calls today")
- Review excerpts moved to a **paid tier** (the endpoint 404s on a free key) —
  the app degrades gracefully and links out to Yelp instead

### Gemini 3.1 Flash Lite — itinerary notes, activity ideas, memory poems
- 1,500 free requests/day, 15/minute
- Personal use never exceeds this

### Cloudinary — memory photos
- ~25 free credits/month (1 credit ≈ 1 GB storage / 1 GB bandwidth / 1k
  transforms, shared) with built-in resize/optimize/CDN
- Signed direct uploads from the browser; assets are destroyed when removed
  from a gallery, so storage doesn't accumulate orphans

### OSRM — travel times between stops
- Public demo server (`router.project-osrm.org`), free, no key
- Results cached 30 days in the DB; haversine fallback if unreachable

### Map display + geocoding — Leaflet + OpenStreetMap + Nominatim
- Leaflet: open-source JavaScript library, free forever
- OpenStreetMap/CartoDB tiles: free for reasonable usage, no API key needed
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
| `YELP_API_KEY` | developer.yelp.com | Free |
| `GEMINI_API_KEY` | Google AI Studio | Free |
| `CLERK_*` keys | clerk.com | Free |
| `RESEND_API_KEY` | resend.com | Free |
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | turso.tech | Free |
| `CLOUDINARY_*` keys | cloudinary.com | Free |
| `VAPID_*` keys | `npx web-push generate-vapid-keys` | Free |

The only real launch cost is the **cutelyask.me domain registration**
(~$10–25/yr, not yet purchased).

---

## If you ever wanted Google instead

Google Maps Platform has a **$200/month recurring credit** that covers both the Maps JavaScript API (interactive map display) and Places API (venue search). At personal scale you'd never exceed $200/month, so it would also be free in practice — but requires a Google Cloud billing account with a credit card on file.
