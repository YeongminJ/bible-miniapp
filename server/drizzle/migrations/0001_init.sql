CREATE TABLE `users` (
	`user_key` text PRIMARY KEY NOT NULL,
	`reminder_minute` integer,
	`daily_enabled` integer DEFAULT true NOT NULL,
	`streak_warn_enabled` integer DEFAULT true NOT NULL,
	`last_played_at` integer,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`timezone` text DEFAULT 'Asia/Seoul' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_key` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`sent_at` integer NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_user_date_type` ON `notifications` (`user_key`,`date`,`type`);
