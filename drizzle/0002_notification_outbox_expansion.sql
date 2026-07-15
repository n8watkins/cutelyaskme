PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `notification_jobs_new` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text,
	`invite_id` text,
	`channel` text NOT NULL,
	`target_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`available_at` text DEFAULT (datetime('now')) NOT NULL,
	`sent_at` text,
	`last_error_code` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `date_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invite_id`) REFERENCES `invites`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `notification_attempts_nonnegative` CHECK (`attempts` >= 0),
	CONSTRAINT `notification_jobs_subject_check` CHECK ((`plan_id` IS NOT NULL) != (`invite_id` IS NOT NULL)),
	CONSTRAINT `notification_jobs_channel_check` CHECK (`channel` IN ('email', 'push')),
	CONSTRAINT `notification_jobs_kind_check` CHECK (`kind` IN ('invite_created', 'sender_plan_completed', 'plan_ready', 'date_canceled')),
	CONSTRAINT `notification_jobs_status_check` CHECK (`status` IN ('pending', 'processing', 'sent', 'failed', 'exhausted', 'canceled'))
);
--> statement-breakpoint
INSERT INTO `notification_jobs_new` (
	`id`, `plan_id`, `channel`, `target_id`, `kind`, `status`, `attempts`, `available_at`,
	`sent_at`, `last_error_code`, `created_at`, `updated_at`
)
SELECT
	`id`, `plan_id`, `channel`, 'email', `kind`, `status`, `attempts`, `available_at`,
	`sent_at`, `last_error_code`, `created_at`, `updated_at`
FROM `notification_jobs`
WHERE `channel` = 'email';
--> statement-breakpoint
INSERT INTO `notification_jobs_new` (
	`id`, `plan_id`, `channel`, `target_id`, `kind`, `status`, `attempts`, `available_at`,
	`sent_at`, `last_error_code`, `created_at`, `updated_at`
)
SELECT
	`notification_jobs`.`id` || ':' || `push_subscriptions`.`id`,
	`notification_jobs`.`plan_id`,
	'push',
	`push_subscriptions`.`id`,
	`notification_jobs`.`kind`,
	`notification_jobs`.`status`,
	`notification_jobs`.`attempts`,
	`notification_jobs`.`available_at`,
	`notification_jobs`.`sent_at`,
	`notification_jobs`.`last_error_code`,
	`notification_jobs`.`created_at`,
	`notification_jobs`.`updated_at`
FROM `notification_jobs`
INNER JOIN `date_plans` ON `date_plans`.`id` = `notification_jobs`.`plan_id`
INNER JOIN `push_subscriptions` ON `push_subscriptions`.`user_id` = `date_plans`.`recipient_id`
WHERE `notification_jobs`.`channel` = 'push';
--> statement-breakpoint
INSERT INTO `notification_jobs_new` (
	`id`, `plan_id`, `channel`, `target_id`, `kind`, `status`, `attempts`, `available_at`,
	`sent_at`, `last_error_code`, `created_at`, `updated_at`
)
SELECT
	`notification_jobs`.`id`,
	`notification_jobs`.`plan_id`,
	'push',
	'legacy:' || `notification_jobs`.`id`,
	`notification_jobs`.`kind`,
	'canceled',
	`notification_jobs`.`attempts`,
	`notification_jobs`.`available_at`,
	`notification_jobs`.`sent_at`,
	'no_push_subscription',
	`notification_jobs`.`created_at`,
	`notification_jobs`.`updated_at`
FROM `notification_jobs`
WHERE
	`notification_jobs`.`channel` = 'push'
	AND NOT EXISTS (
		SELECT 1
		FROM `date_plans`
		INNER JOIN `push_subscriptions` ON `push_subscriptions`.`user_id` = `date_plans`.`recipient_id`
		WHERE `date_plans`.`id` = `notification_jobs`.`plan_id`
	);
--> statement-breakpoint
DROP TABLE `notification_jobs`;
--> statement-breakpoint
ALTER TABLE `notification_jobs_new` RENAME TO `notification_jobs`;
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_jobs_plan_delivery_unique` ON `notification_jobs` (`plan_id`,`channel`,`kind`,`target_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_jobs_invite_delivery_unique` ON `notification_jobs` (`invite_id`,`channel`,`kind`,`target_id`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
