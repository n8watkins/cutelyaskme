# Cost Breakdown

All pricing as of June 2025. This is a personal-scale app — estimates assume a few dozen uses/month.

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
- With 24h DB caching, a given (food type + city) pair is fetched once per day max
- At personal scale (~30 searches/month) this never comes close to 500/day

### Gemini 2.5 Flash — AI itinerary
- 1,500 free requests/day, 15/minute
- Personal use never exceeds this

### Map display — Leaflet + OpenStreetMap
- Leaflet: open-source JavaScript library, free forever
- OpenStreetMap: volunteer-built map tiles, free for reasonable usage, no API key needed
- Together they render the interactive pin-drop map on the plan view

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

---

## If you ever wanted Google instead

Google Maps Platform has a **$200/month recurring credit** that covers both the Maps JavaScript API (interactive map display) and Places API (venue search). At personal scale you'd never exceed $200/month, so it would also be free in practice — but requires a Google Cloud billing account with a credit card on file.
