ALTER TABLE `invites` ADD `location_lat` real;
--> statement-breakpoint
ALTER TABLE `invites` ADD `location_lng` real;
--> statement-breakpoint
ALTER TABLE `invites` ADD `capability_version` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `date_plans` ADD `timezone` text NOT NULL DEFAULT 'UTC';
--> statement-breakpoint
ALTER TABLE `date_plans` ADD `notification_mode` text;
--> statement-breakpoint
ALTER TABLE `date_plans` ADD `revealed_at` text;
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
INSERT INTO `plan_stops` (`id`, `plan_id`, `position`, `kind`, `activity`, `duration_minutes`, `venue`)
SELECT
	date_plans.id || ':activity:' || activities.key,
	date_plans.id,
	CAST(activities.key AS integer),
	'activity',
	activities.value,
	CASE activities.value
		WHEN 'Coffee' THEN 45
		WHEN 'Movie' THEN 120
		WHEN 'Arcade' THEN 90
		WHEN 'Bookstore' THEN 60
		WHEN 'Drinks' THEN 75
		WHEN 'Photo booth' THEN 30
		WHEN 'Mini golf' THEN 90
		WHEN 'Sunset view' THEN 45
		WHEN 'Gallery stroll' THEN 75
		WHEN 'Park picnic' THEN 90
		WHEN 'Thrift browse' THEN 60
		WHEN 'Record store' THEN 45
		WHEN 'Plant shop' THEN 45
		WHEN 'Museum' THEN 120
		WHEN 'Board games' THEN 90
		WHEN 'Karaoke' THEN 90
		WHEN 'Live music' THEN 120
		WHEN 'Stargazing' THEN 60
		WHEN 'Scenic drive' THEN 60
		WHEN 'Tea stop' THEN 45
		WHEN 'Surprise ending' THEN 60
		ELSE 60
	END,
	json_extract(date_plans.selected_activity_venues, '$.' || json_quote(activities.value))
FROM date_plans, json_each(date_plans.selected_activities) AS activities
WHERE json_valid(date_plans.selected_activities);
--> statement-breakpoint
INSERT INTO `plan_stops` (`id`, `plan_id`, `position`, `kind`, `activity`, `duration_minutes`, `venue`)
SELECT
	id || ':entree',
	id,
	CASE
		WHEN json_valid(selected_activities) THEN json_array_length(selected_activities)
		ELSE 0
	END,
	'entree',
	selected_entree,
	75,
	selected_entree_venue
FROM date_plans
WHERE
	selected_entree IS NOT NULL
	AND trim(selected_entree) <> ''
	AND selected_entree <> 'Surprise me';
