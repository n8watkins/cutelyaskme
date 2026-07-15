CREATE TABLE `plan_timezone_backfill_manifest` (
	`plan_id` text PRIMARY KEY NOT NULL,
	`captured_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `date_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `plan_timezone_backfill_manifest` (`plan_id`)
SELECT `plan_id` FROM `plan_timezone_backfills`;
