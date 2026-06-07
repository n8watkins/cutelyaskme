import { text, integer, real, sqliteTable, unique, check } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// A user's saved places (Home, partner's place, etc.) for quick reuse.
export const savedAddresses = sqliteTable("saved_addresses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  label: text("label").notNull(),
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
  senderAvatarSrc: text("sender_avatar_src"),
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
  selectedEntree: text("selected_entree"),
  selectedActivities: text("selected_activities").notNull().default("[]"),
  selectedEntreeVenue: text("selected_entree_venue"),
  selectedActivityVenues: text("selected_activity_venues").notNull().default("{}"),
  itinerary: text("itinerary"),
  itineraryGeneratedAt: text("itinerary_generated_at"),
  dressVibe: text("dress_vibe"),
  // Set when the sender locks venues + hits Share/Surprise. Gates post-date reviews.
  confirmedAt: text("confirmed_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

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
