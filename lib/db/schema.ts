import { text, integer, sqliteTable, unique, check } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

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
