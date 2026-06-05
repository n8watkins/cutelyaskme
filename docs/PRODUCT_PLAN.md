# Date Planner Product Plan

## Product Direction

Date Planner starts as a cute personalized invite mini-site, then grows into a date planning and memory platform.

The product should keep the emotional hook:

> a tiny custom digital love note that turns into a real date plan.

## V1 PRD: Personalized Invite Mini-Site

### Goal

Ship a polished, mobile-first date invitation experience that works without auth, database, or backend persistence.

### Primary User Flow

1. Recipient opens `/invite/[name]`.
2. Recipient sees a personalized date question.
3. Recipient can click `Yes! ♥`; `No` playfully dodges.
4. Recipient picks a day from quick suggestions or `Cute Cal`.
5. Recipient picks a preset time or custom time.
6. Recipient picks two date moments.
7. Recipient optionally asks Gemini for cute activity ideas.
8. Recipient picks food and sweet finish.
9. Recipient gets a final summary and can share/copy the plan.

### Current V1 Features Implemented

- Next.js App Router project.
- Dynamic invite route: `/invite/[recipient]`.
- Step-based wizard.
- Evasive `No` button with randomized copy.
- `Yes! ♥` acceptance with confetti.
- Branded `Cute Cal` month picker.
- Date quick picks.
- Far-future date hover copy.
- Preset time cards.
- Custom time picker.
- Blocks past times when selected date is today.
- Time-aware activity suggestions.
- Budget filter for date moments.
- Local idea spinner.
- Optional Gemini idea endpoint.
- Food and sweet finish step.
- Final summary.
- Native share / clipboard fallback.
- Floating hearts/stars and animated gradient background.
- Top-right digital avatar commentary.
- Lightweight person cursor prototype.

### V1 Acceptance Criteria

- App builds and deploys cleanly.
- Recipient can complete a full invite flow.
- Recipient can share/copy the final plan.
- No database required.
- Gemini is optional; app still works without `GEMINI_API_KEY`.
- Mobile layout remains usable.
- Reduced-motion preferences are respected where practical.

### V1 Environment Variables

```txt
GEMINI_API_KEY=
```

`GEMINI_API_KEY` is optional for V1. Without it, Gemini suggestions return a friendly fallback and local spinner still works.

## V2 PRD: Authenticated Date Planner

### Goal

Turn the mini-site into a real product where a sender can create invites, see recipient choices, update plans, add calendar events, email the plan, and save date history.

### Primary User Roles

Sender:
- Signs in with Google.
- Creates invite links.
- Views recipient responses.
- Picks final venues.
- Updates calendar/email.
- Saves date memories.

Recipient:
- Opens invite.
- Optionally signs in with Google for calendar features.
- Picks availability, activities, food, and preferences.
- Can opt into email/calendar updates.

### V2 Core Features

- Google OAuth sign-in.
- Sender dashboard.
- Persistent invites.
- Persistent recipient responses.
- Editable date plans.
- Google Calendar integration.
- Optional email notification.
- Date history log.
- Photo uploads.
- Collage builder.
- Cute recap stats.
- Venue recommendations.
- Route/order suggestions.

### V2 Data Model Draft

```ts
type User = {
  id: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
  googleAccessTokenEncrypted?: string;
  createdAt: string;
};

type Invite = {
  id: string;
  senderId: string;
  recipientName: string;
  slug: string;
  status: "draft" | "sent" | "accepted" | "planned" | "completed";
  createdAt: string;
  updatedAt: string;
};

type DateResponse = {
  id: string;
  inviteId: string;
  selectedDate: string;
  selectedTime: string;
  activities: string[];
  food: string | null;
  dessert: string | null;
  noAttempts: number;
  spinnerRolls: number;
  geminiRequests: number;
  timeToAcceptMs: number | null;
  createdAt: string;
};

type VenueOption = {
  id: string;
  inviteId: string;
  activityType: string;
  placeId: string;
  name: string;
  rating: number | null;
  priceLevel: string | null;
  address: string | null;
  mapsUrl: string | null;
  selected: boolean;
};

type DatePlan = {
  id: string;
  inviteId: string;
  responseId: string;
  selectedVenueIds: string[];
  routeSummary: string | null;
  calendarEventId: string | null;
  emailSentAt: string | null;
  finalizedAt: string | null;
};

type DateMemory = {
  id: string;
  inviteId: string;
  caption: string | null;
  photoUrls: string[];
  collageUrl: string | null;
  createdAt: string;
};
```

### V2 Integrations

- Auth: Google OAuth via Auth.js, Clerk, or Supabase Auth.
- Database: Postgres through Supabase, Neon, or Vercel Postgres.
- Storage: Supabase Storage, S3, or Cloudflare R2.
- Email: Resend or Postmark.
- Calendar: Google Calendar API.
- Venue data: Google Places API.
- Routing: Google Routes API.
- AI: Gemini for idea generation, copy, ranking explanations, summaries.

### Calendar Consent

Calendar writes require explicit user consent.

Recommended behavior:
- Sender can add/update their own calendar after Google OAuth.
- Recipient can opt in by signing in with Google.
- Without recipient consent, send an `.ics` file or calendar link instead of writing to their calendar.

### Analytics / Cute Stats

Store lightweight interaction stats:
- No hover/click attempts.
- Time before Yes.
- Date changes.
- Time changes.
- Spinner rolls.
- Gemini idea requests.
- Food changes.
- Final selected plan.

Use these for a final recap:

```txt
You tried to click No 7 times.
You rolled date ideas 4 times.
Final verdict: dinner + photo booth + sunset view.
```

## V3 Ideas

- Venue discount/deal discovery.
- Personalized recommendation memory.
- Relationship/date timeline.
- Anniversary reminders.
- Public/private date albums.
- AI collage captions.
- Shared couple dashboard.
- Theme packs.

## Deployment Recommendation

### Recommendation: Vercel for V1

Use Vercel for the current project.

Reasons:
- The app is already a Next.js App Router app.
- Vercel is zero-config for Next.js.
- Preview deployments are useful while iterating on UI.
- API routes like `/api/date-ideas` work naturally.
- Environment variables are straightforward.

Vercel’s official docs state that deploying Next.js to Vercel is zero-configuration and provides platform optimizations for scalability, availability, and global performance.

### When Firebase Makes Sense

Firebase becomes more interesting if V2 is deeply Google/Firebase-native:

- Firebase Auth.
- Firestore.
- Firebase Storage.
- Firebase App Hosting.
- Google Cloud services.

Firebase App Hosting officially supports Next.js, but Firebase’s framework-aware Hosting docs still call that path early public preview and recommend Firebase App Hosting for full-stack Next.js apps.

### Practical Choice

For this project:

- V1: Vercel.
- V2: Vercel + Supabase/Neon is the fastest path.
- V2 all-Google stack: Firebase App Hosting + Firestore/Cloud Storage is viable, but expect more configuration.

## Vercel Deployment Checklist

1. Push repo to GitHub.
2. Import project into Vercel.
3. Set framework preset to Next.js.
4. Set root directory to:

```txt
date-planner-mini-site
```

5. Add environment variables:

```txt
GEMINI_API_KEY=your_key_here
```

6. Deploy.
7. Test:

```txt
/invite/sarah
/api/date-ideas
```

8. Add custom domain.
9. Configure production and preview environment variables separately.

## Future Deployment Needs for V2

When V2 starts, add:

```txt
DATABASE_URL=
AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALENDAR_SCOPES=
RESEND_API_KEY=
GOOGLE_MAPS_API_KEY=
GEMINI_API_KEY=
STORAGE_BUCKET=
```

Security requirements:
- Encrypt OAuth tokens.
- Do not expose API keys in client code unless they are browser-restricted.
- Use server routes for Gemini, venue search, calendar writes, and emails.
- Add rate limits for AI and venue endpoints.
- Add consent language before calendar/email actions.

## Official References

- Vercel Next.js deployment: https://vercel.com/docs/concepts/next.js/overview
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Firebase Next.js hosting: https://firebase.google.com/docs/hosting/frameworks/nextjs
- Firebase App Hosting: https://firebase.google.com/docs/app-hosting
- Gemini API: https://ai.google.dev/api
- Google Places Nearby Search: https://developers.google.com/maps/documentation/places/web-service/nearby-search
- Google Routes Matrix: https://developers.google.com/maps/documentation/routes/compute_route_matrix
