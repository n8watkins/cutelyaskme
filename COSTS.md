# Cost Breakdown

All pricing as of June 2025. This is a personal-scale app — the estimates below assume low traffic (a few dozen uses/month).

---

## Services

### Vercel — Hosting
**Free (Hobby plan)**

- Serverless functions, static assets, CDN
- 100 GB bandwidth/month
- Automatic SSL, preview deployments
- No cost for personal projects under Hobby limits

### Turso — Database (libSQL / SQLite)
**Free (Starter plan)**

- 500 databases, 9 GB storage
- 1 billion row reads/month, 25 million row writes/month
- More than sufficient for a personal app

### Clerk — Authentication
**Free tier**

- 10,000 monthly active users (MAU)
- Unlimited sign-ins, social OAuth, email magic links
- Pro tier ($25/mo) only needed if you exceed 10k MAUs

### Resend — Email
**Free tier**

- 3,000 emails/month, 100/day
- Sends invite emails + plan-confirmed notifications
- Pro ($20/mo) for higher volume

---

## Pay-per-use APIs

### Google Places (New) — Venue search
**~$0.017 per request**

- Text Search (New) endpoint: $17.00 per 1,000 requests
- With 24h DB caching, each unique `(query, location)` pair is only fetched once per day
- For ~50 invites/month, real cost approaches **$0** (cache absorbs almost all repeat lookups)
- New Google Cloud accounts receive **$300 free credit**

| Monthly invites | Uncached requests | Est. cost |
|---|---|---|
| 10 | ~30 (3 searches each: entree + 2 activities) | ~$0.51 |
| 50 | ~150 (mostly cached) | ~$1.00 |
| 200 | ~200 (heavy cache hits) | ~$3.40 |

### Google Gemini 2.5 Flash — AI itinerary
**~$0.001–$0.003 per itinerary**

- Input: $0.15 / 1M tokens (~300 tokens per prompt = $0.000045)
- Output: $0.60 / 1M tokens (~300 tokens per response = $0.00018)
- Cost per generated itinerary: **< $0.001**
- Free tier: 15 requests/min, 1,500/day — covers personal use without any charges

| Monthly plans | Est. cost |
|---|---|
| 50 | ~$0.01 |
| 500 | ~$0.12 |

---

## Total Estimate

| Usage level | Monthly cost |
|---|---|
| Light (< 20 invites) | **$0** (all free tiers) |
| Moderate (50 invites) | **~$1–2** (Places API) |
| Active (200 invites) | **~$4–6** (Places + Gemini) |

The only real spend at personal scale is Google Places. Everything else stays free.

---

## Required API Keys

| Key | Where to get | Cost |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Google Cloud Console → APIs & Services | Pay per use (see above) |
| `GEMINI_API_KEY` | Google AI Studio | Free tier covers personal use |
| `CLERK_*` keys | clerk.com | Free |
| `RESEND_API_KEY` | resend.com | Free |
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | turso.tech | Free |
