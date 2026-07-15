import { text, integer, real, sqliteTable, unique, check } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// A user's saved places (Home, partner's place, etc.) for quick reuse.
export const savedAddresses = sqliteTable("saved_addresses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  label: text("label").notNull(),
  // "home" | "pickup" | "custom" — home/pickup are singletons per user (upserted on save)
  kind: text("kind").notNull().default("custom"),
  address: text("address").notNull(),
  lat: real("lat"),
  lng: real("lng"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const invites = sqliteTable("invites", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  senderId: text("sender_id").notNull(),
  recipientName: text("recipient_name").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  location: text("location"),
  locationLat: real("location_lat"),
  locationLng: real("location_lng"),
  senderAvatarSrc: text("sender_avatar_src"),
  // Rotating this invalidates every anonymous capability minted for the invite.
  capabilityVersion: integer("capability_version").notNull().default(1),
  status: text("status", { enum: ["pending", "completed", "cancelled"] })
    .notNull()
    .default("pending"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const datePlans = sqliteTable("date_plans", {
  id: text("id").primaryKey(),
  inviteId: text("invite_id"),
  senderId: text("sender_id").notNull(),
  recipientId: text("recipient_id"),
  selectedDate: text("selected_date"),
  selectedDateLabel: text("selected_date_label"),
  selectedTime: text("selected_time"),
  selectedTimeLabel: text("selected_time_label"),
  // IANA zone for all lifecycle decisions and calendar output.
  timezone: text("timezone").notNull().default("UTC"),
  selectedEntree: text("selected_entree"),
  selectedActivities: text("selected_activities").notNull().default("[]"),
  selectedEntreeVenue: text("selected_entree_venue"),
  selectedActivityVenues: text("selected_activity_venues").notNull().default("{}"),
  itinerary: text("itinerary"),
  itineraryGeneratedAt: text("itinerary_generated_at"),
  dressVibe: text("dress_vibe"),
  // Start / pickup waypoints chosen by the sender (JSON: { label, lat, lng }).
  startPoint: text("start_point"),
  pickupPoint: text("pickup_point"),
  // D3: per-leg travel mode picks (JSON: { "pickup→Coffee": "walk" }); keys are
  // "fromId→toId" node ids (start/pickup/stop key), absent = drive.
  legModes: text("leg_modes").notNull().default("{}"),
  // How confirmed details become visible to the recipient.
  notificationMode: text("notification_mode", { enum: ["share", "surprise"] }),
  // Set when surprise details become visible. Share mode is visible immediately.
  revealedAt: text("revealed_at"),
  // Set when the sender locks venues + hits Share/Surprise. Gates post-date reviews.
  confirmedAt: text("confirmed_at"),
  completedAt: text("completed_at"),
  // F4: set when the sender calls the date off. A canceled plan is frozen —
  // no edits, no notifications, hidden from Upcoming.
  canceledAt: text("canceled_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const planTimezoneBackfills = sqliteTable("plan_timezone_backfills", {
  planId: text("plan_id")
    .primaryKey()
    .references(() => datePlans.id, { onDelete: "cascade" }),
  previousTimezone: text("previous_timezone").notNull(),
  verifiedTimezone: text("verified_timezone").notNull(),
  verifiedAt: text("verified_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Stable, ordered stops replace activity-name keyed parallel JSON objects.
// Legacy columns remain during the compatibility rollout and are removed only
// after every reader and writer has moved to this table.
export const planStops = sqliteTable(
  "plan_stops",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => datePlans.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: text("kind", { enum: ["activity", "entree"] }).notNull(),
    activity: text("activity").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    travelMinutes: integer("travel_minutes").notNull().default(0),
    venue: text("venue"),
    legMode: text("leg_mode", { enum: ["drive", "walk"] })
      .notNull()
      .default("drive"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    unique("plan_stops_plan_position_unique").on(table.planId, table.position),
    check("duration_minutes_range", sql`${table.durationMinutes} >= 15 AND ${table.durationMinutes} <= 720`),
    check("travel_minutes_range", sql`${table.travelMinutes} >= 0 AND ${table.travelMinutes} <= 720`),
  ],
);

export const dateRatings = sqliteTable(
  "date_ratings",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id").notNull(),
    raterId: text("rater_id").notNull(),
    score: integer("score").notNull(),
    note: text("note"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    unique("ratings_plan_rater_unique").on(table.planId, table.raterId),
    check("score_range", sql`${table.score} >= 1 AND ${table.score} <= 5`),
  ],
);

// One pass/fail verdict per user per venue ("would we go back?").
// Unique on (user, venue) so re-swiping a place updates rather than duplicating —
// this is also how we de-dupe a spot liked across multiple dates.
export const venueVerdicts = sqliteTable(
  "venue_verdicts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    planId: text("plan_id").notNull(),
    activity: text("activity"), // e.g. "Coffee", "__entree__"
    venueId: text("venue_id").notNull(),
    venue: text("venue").notNull(), // JSON snapshot of the Venue
    // neutral = default / didn't go / closed; only "liked" feeds Reminisce.
    status: text("status", { enum: ["liked", "disliked", "neutral"] })
      .notNull()
      .default("neutral"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [unique("verdict_user_venue_unique").on(table.userId, table.venueId)],
);

// A post-date keepsake one participant writes: their notes + an AI poem (+ photos).
// One per (plan, author) so each person keeps their own memory.
export const dateMemories = sqliteTable(
  "date_memories",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id").notNull(),
    authorId: text("author_id").notNull(),
    notes: text("notes"), // freeform highlights / funny moments
    poem: text("poem"), // Gemini-generated keepsake
    photoRefs: text("photo_refs").notNull().default("[]"), // JSON [{ url, publicId }]
    // G1: public share-link token for the keepsake card — null = participants only.
    shareToken: text("share_token").unique(),
    // G1: background music for the keepsake card — a MUSIC_TRACKS id
    // (lib/memory-music.ts); null = the default track.
    musicTrack: text("music_track"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [unique("memory_plan_author_unique").on(table.planId, table.authorId)],
);

// Web Push subscriptions — one row per device a user enabled notifications on.
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// B4: per-user app settings — 1 row per user, keyed by Clerk userId.
// Defaults/validation live in lib/settings.ts (DEFAULT_SETTINGS); the row is
// created lazily on first PATCH, so "no row" simply means "all defaults".
export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id").primaryKey(),
  // B3: planner radius slider — initial value + user-tunable bounds (1–25 mi, Yelp cap).
  defaultRadiusMi: integer("default_radius_mi").notNull().default(5),
  radiusMinMi: integer("radius_min_mi").notNull().default(1),
  radiusMaxMi: integer("radius_max_mi").notNull().default(25),
  // A2: map wheel-zoom mode (absorbs the ca:mapZoomMode localStorage key).
  mapZoomMode: text("map_zoom_mode", { enum: ["ctrl", "plain"] })
    .notNull()
    .default("ctrl"),
  // E3: calendar export shape (absorbs ca:calendarMode).
  calendarMode: text("calendar_mode", { enum: ["single", "per-stop"] })
    .notNull()
    .default("single"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Persistent rate limiting (survives serverless cold starts).
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: integer("reset_at").notNull(), // ms epoch
});

// Atomic service budgets use one row per service, subject, and fixed window.
// `subject_id` is a Clerk user id, an anonymous capability fingerprint, or
// "global" for the application-wide ceiling.
export const serviceBudgets = sqliteTable(
  "service_budgets",
  {
    key: text("key").primaryKey(),
    service: text("service").notNull(),
    subjectId: text("subject_id").notNull(),
    windowStart: integer("window_start").notNull(),
    windowEnd: integer("window_end").notNull(),
    count: integer("count").notNull().default(0),
    limit: integer("limit_value").notNull(),
  },
  (table) => [
    unique("service_budgets_window_unique").on(
      table.service,
      table.subjectId,
      table.windowStart,
    ),
    check("service_budget_nonnegative", sql`${table.count} >= 0 AND ${table.limit} > 0`),
  ],
);

// Durable notification outbox. Confirmation never depends on email or push
// availability, and channel delivery can retry idempotently.
export const notificationJobs = sqliteTable(
  "notification_jobs",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id").references(() => datePlans.id, { onDelete: "cascade" }),
    inviteId: text("invite_id").references(() => invites.id, { onDelete: "cascade" }),
    channel: text("channel", { enum: ["email", "push"] }).notNull(),
    // Email has the stable target "email". Push jobs use one subscription id so
    // retries cannot resend successfully delivered sibling subscriptions.
    targetId: text("target_id").notNull(),
    kind: text("kind", {
      enum: ["invite_created", "sender_plan_completed", "plan_ready", "date_canceled"],
    }).notNull(),
    status: text("status", {
      enum: ["pending", "processing", "sent", "failed", "exhausted", "canceled"],
    })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: text("available_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    sentAt: text("sent_at"),
    lastErrorCode: text("last_error_code"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    unique("notification_jobs_plan_delivery_unique").on(
      table.planId,
      table.channel,
      table.kind,
      table.targetId,
    ),
    unique("notification_jobs_invite_delivery_unique").on(
      table.inviteId,
      table.channel,
      table.kind,
      table.targetId,
    ),
    check(
      "notification_jobs_subject_check",
      sql`(${table.planId} IS NOT NULL) != (${table.inviteId} IS NOT NULL)`,
    ),
    check("notification_attempts_nonnegative", sql`${table.attempts} >= 0`),
  ],
);

// Daily outbound API call counts (C7). Unattributed calls live in one row per
// service+day (key = "service:YYYY-MM-DD", UTC); calls made while planning a
// specific date get their own row per plan (key = "service:YYYY-MM-DD:planId",
// plan_id set). A service's daily total is therefore SUM(count) over its rows.
export const apiUsage = sqliteTable("api_usage", {
  key: text("key").primaryKey(),
  service: text("service").notNull(),
  day: text("day").notNull(),
  planId: text("plan_id"),
  count: integer("count").notNull().default(0),
});

export const placeCache = sqliteTable("place_cache", {
  id: text("id").primaryKey(),
  cacheKey: text("cache_key").notNull().unique(),
  results: text("results").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export type ItineraryJson = {
  title: string;
  summary: string;
  timeline: { time: string; emoji: string; activity: string; note: string }[];
  tips: string[];
};
