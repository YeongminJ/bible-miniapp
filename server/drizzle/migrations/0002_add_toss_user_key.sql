ALTER TABLE `users` ADD COLUMN `toss_user_key` text;
--> statement-breakpoint
CREATE INDEX `users_toss_user_key_idx` ON `users` (`toss_user_key`);
