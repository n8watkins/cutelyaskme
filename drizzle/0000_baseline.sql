CREATE TABLE `api_usage` (
	`key` text PRIMARY KEY NOT NULL,
	`service` text NOT NULL,
	`day` text NOT NULL,
	`plan_id` text,
	`count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `date_memories` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`author_id` text NOT NULL,
	`notes` text,
	`poem` text,
	`photo_refs` text DEFAULT '[]' NOT NULL,
	`share_token` text,
	`music_track` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `date_memories_share_token_unique` ON `date_memories` (`share_token`);
--> statement-breakpoint
CREATE UNIQUE INDEX `memory_plan_author_unique` ON `date_memories` (`plan_id`,`author_id`);
--> statement-breakpoint
CREATE TABLE `date_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`invite_id` text,
	`sender_id` text NOT NULL,
	`recipient_id` text,
	`selected_date` text,
	`selected_date_label` text,
	`selected_time` text,
	`selected_time_label` text,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`selected_entree` text,
	`selected_activities` text DEFAULT '[]' NOT NULL,
	`selected_entree_venue` text,
	`selected_activity_venues` text DEFAULT '{}' NOT NULL,
	`itinerary` text,
	`itinerary_generated_at` text,
	`dress_vibe` text,
	`start_point` text,
	`pickup_point` text,
	`leg_modes` text DEFAULT '{}' NOT NULL,
	`notification_mode` text,
	`revealed_at` text,
	`confirmed_at` text,
	`completed_at` text,
	`canceled_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT `date_plans_notification_mode_check` CHECK (`notification_mode` IS NULL OR `notification_mode` IN ('share', 'surprise'))
);
--> statement-breakpoint
CREATE TABLE `date_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`rater_id` text NOT NULL,
	`score` integer NOT NULL,
	`note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT `score_range` CHECK (`score` >= 1 AND `score` <= 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ratings_plan_rater_unique` ON `date_ratings` (`plan_id`,`rater_id`);
--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_name` text NOT NULL,
	`recipient_email` text NOT NULL,
	`location` text,
	`location_lat` real,
	`location_lng` real,
	`sender_avatar_src` text,
	`capability_version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT `invites_status_check` CHECK (`status` IN ('pending', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_token_unique` ON `invites` (`token`);
--> statement-breakpoint
CREATE TABLE `notification_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`channel` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`available_at` text DEFAULT (datetime('now')) NOT NULL,
	`sent_at` text,
	`last_error_code` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `date_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `notification_attempts_nonnegative` CHECK (`attempts` >= 0),
	CONSTRAINT `notification_jobs_channel_check` CHECK (`channel` IN ('email', 'push')),
	CONSTRAINT `notification_jobs_kind_check` CHECK (`kind` IN ('plan_ready', 'date_canceled')),
	CONSTRAINT `notification_jobs_status_check` CHECK (`status` IN ('pending', 'processing', 'sent', 'failed', 'canceled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_jobs_delivery_unique` ON `notification_jobs` (`plan_id`,`channel`,`kind`);
--> statement-breakpoint
CREATE TABLE `place_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`cache_key` text NOT NULL,
	`results` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `place_cache_cache_key_unique` ON `place_cache` (`cache_key`);
--> statement-breakpoint
CREATE TABLE `plan_stops` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`position` integer NOT NULL,
	`kind` text NOT NULL,
	`activity` text NOT NULL,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`travel_minutes` integer DEFAULT 0 NOT NULL,
	`venue` text,
	`leg_mode` text DEFAULT 'drive' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `date_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `duration_minutes_range` CHECK (`duration_minutes` >= 15 AND `duration_minutes` <= 720),
	CONSTRAINT `travel_minutes_range` CHECK (`travel_minutes` >= 0 AND `travel_minutes` <= 720),
	CONSTRAINT `plan_stops_kind_check` CHECK (`kind` IN ('activity', 'entree')),
	CONSTRAINT `plan_stops_leg_mode_check` CHECK (`leg_mode` IN ('drive', 'walk'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_stops_plan_position_unique` ON `plan_stops` (`plan_id`,`position`);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saved_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`kind` text DEFAULT 'custom' NOT NULL,
	`address` text NOT NULL,
	`lat` real,
	`lng` real,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `service_budgets` (
	`key` text PRIMARY KEY NOT NULL,
	`service` text NOT NULL,
	`subject_id` text NOT NULL,
	`window_start` integer NOT NULL,
	`window_end` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`limit_value` integer NOT NULL,
	CONSTRAINT `service_budget_nonnegative` CHECK (`count` >= 0 AND `limit_value` > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_budgets_window_unique` ON `service_budgets` (`service`,`subject_id`,`window_start`);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`default_radius_mi` integer DEFAULT 5 NOT NULL,
	`radius_min_mi` integer DEFAULT 1 NOT NULL,
	`radius_max_mi` integer DEFAULT 25 NOT NULL,
	`map_zoom_mode` text DEFAULT 'ctrl' NOT NULL,
	`calendar_mode` text DEFAULT 'single' NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT `user_settings_zoom_check` CHECK (`map_zoom_mode` IN ('ctrl', 'plain')),
	CONSTRAINT `user_settings_calendar_check` CHECK (`calendar_mode` IN ('single', 'per-stop'))
);
--> statement-breakpoint
CREATE TABLE `venue_verdicts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`activity` text,
	`venue_id` text NOT NULL,
	`venue` text NOT NULL,
	`status` text DEFAULT 'neutral' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT `venue_verdict_status_check` CHECK (`status` IN ('liked', 'disliked', 'neutral'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verdict_user_venue_unique` ON `venue_verdicts` (`user_id`,`venue_id`);
