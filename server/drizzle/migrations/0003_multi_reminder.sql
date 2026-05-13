-- Migration 0003: 사용자당 다중 reminder 시각 지원
--   - `user_reminders` 테이블 신설 (user_key, minute) 1:N
--   - 기존 `users.reminder_minute` 값 1행씩 백필
--   - `notifications`에 `minute` 컬럼 추가하고 unique를 (user_key, date, type, minute)으로 변경
--   - 레거시 row는 minute=NULL (SQLite에서 NULL은 UNIQUE상 서로 distinct)

CREATE TABLE `user_reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_key` text NOT NULL,
	`minute` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_reminders_user_minute_uniq` ON `user_reminders` (`user_key`,`minute`);
--> statement-breakpoint
CREATE INDEX `user_reminders_minute_idx` ON `user_reminders` (`minute`);
--> statement-breakpoint
INSERT INTO `user_reminders` (`user_key`, `minute`, `created_at`)
  SELECT `user_key`, `reminder_minute`, `updated_at`
  FROM `users`
  WHERE `reminder_minute` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `notifications` ADD COLUMN `minute` integer;
--> statement-breakpoint
DROP INDEX `notifications_user_date_type`;
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_user_date_type_minute` ON `notifications` (`user_key`,`date`,`type`,`minute`);
