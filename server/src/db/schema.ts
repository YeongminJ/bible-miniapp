import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * 사용자 한 명당 1행. `user_key`는 토스 로그인 OAuth로 발급받은 식별자.
 *
 * 푸시 정책:
 * - `reminder_minute`이 null이면 모든 푸시 비활성화.
 * - cron이 `reminder_minute` 도래 시 한 번 발화. 발화 시점 사용자 상태에 따라
 *   (a) 데일리 리마인드 / (c) 스트릭 끊김 경고 중 하나를 선택해 발송.
 *
 * 도메인:
 * - "play" = 퀴즈 풀이 1회 완료 (또는 그 외 미니앱이 정의한 daily action).
 */
export const users = sqliteTable("users", {
  userKey: text("user_key").primaryKey(),
  /** 알림 받을 KST 분(0~1439). null이면 비활성. */
  reminderMinute: integer("reminder_minute"),
  /** 데일리 리마인드 활성 여부. */
  dailyEnabled: integer("daily_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  /** 스트릭 끊김 경고 활성 여부. */
  streakWarnEnabled: integer("streak_warn_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  /** 마지막 플레이 epoch ms. 클라가 `/api/users/:userKey/play`로 갱신. */
  lastPlayedAt: integer("last_played_at"),
  /** 현재 연속 플레이 일수. */
  currentStreak: integer("current_streak").notNull().default(0),
  timezone: text("timezone").notNull().default("Asia/Seoul"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/**
 * 발송 이력. 같은 (userKey, date, type)에 대해 한 번만 sent.
 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userKey: text("user_key").notNull(),
    date: text("date").notNull(), // KST 'YYYY-MM-DD'
    /** 'daily' | 'streak_warn' */
    type: text("type").notNull(),
    /** 'sent' | 'failed' | 'skipped' */
    status: text("status").notNull(),
    sentAt: integer("sent_at").notNull(),
    error: text("error"),
  },
  (t) => ({
    uniq: uniqueIndex("notifications_user_date_type").on(
      t.userKey,
      t.date,
      t.type,
    ),
  }),
);
