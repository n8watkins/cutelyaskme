CREATE TABLE `plan_timezone_backfills` (
	`plan_id` text PRIMARY KEY NOT NULL,
	`previous_timezone` text NOT NULL,
	`verified_timezone` text NOT NULL,
	`verified_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `date_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
