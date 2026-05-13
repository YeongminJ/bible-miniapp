import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * 사용자 한 명당 1행.
 * `user_key`는 클라 내부 식별자(`getAnonymousKey()` HASH).
 * `toss_user_key`는 토스 OAuth(`appLogin` → `/api/auth/migration/link`)로 매핑된 토스 userKey —
 * 푸시(스마트 발송) 라우팅에 헤더 `x-toss-user-key`로 사용. 매핑 안 된 사용자는 NULL.
 *
 * 푸시 정책:
 * - 알림 시각은 `user_reminders` 테이블에서 1:N 으로 관리. 사용자가 10:00 + 20:00 둘 다 등록 가능.
 * - `users.reminder_minute` 컬럼은 v0.x 호환을 위해 남겨둔 레거시 필드 (현재 코드는 읽지/쓰지 않음).
 * - `toss_user_key`가 null이면 cron이 발송 단계에서 skip (토스가 라우팅 못 함).
 * - cron이 reminder 도래 시 한 번 발화. 발화 시점 사용자 상태에 따라
 *   (a) 데일리 리마인드 / (b) 스트릭 끊김 경고 중 하나를 선택해 발송.
 *
 * 도메인:
 * - "play" = 퀴즈 풀이 1회 완료 (또는 그 외 미니앱이 정의한 daily action).
 */
export const users = sqliteTable("users", {
  userKey: text("user_key").primaryKey(),
  /** 토스 OAuth로 매핑된 사용자만 NOT NULL. 푸시 라우팅 키. */
  tossUserKey: text("toss_user_key"),
  /**
   * 토스 OAuth login-me 응답의 `name` (user_name scope 동의한 경우만).
   * 공유 메시지 등에서 "{이름}님" prefix 용도.
   */
  name: text("name"),
  /**
   * @deprecated v0.3 이후 `user_reminders` 테이블 사용. 마이그레이션 호환을 위해 컬럼은 유지.
   */
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
 * 사용자가 받기로 한 알림 시각들. 사용자당 N행.
 * 예: 김토스님이 10:00 + 20:00 → (user_key, 600) + (user_key, 1200) 2행.
 *
 * cron이 매분 `WHERE minute = ?`로 후보 사용자들을 픽업.
 * 같은 사용자가 같은 분에 중복 등록되지 않도록 `(user_key, minute)` UNIQUE.
 */
export const userReminders = sqliteTable(
  "user_reminders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userKey: text("user_key").notNull(),
    /** KST 기준 분 (0~1439). 자정=0, 10:00=600, 20:00=1200. */
    minute: integer("minute").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("user_reminders_user_minute_uniq").on(t.userKey, t.minute),
    minuteIdx: index("user_reminders_minute_idx").on(t.minute),
  }),
);

/**
 * 발송 이력. 같은 (userKey, date, type, minute)에 대해 한 번만 sent.
 * minute 컬럼은 v0.3에서 추가됨 — 같은 날 두 reminder(10:00 + 20:00)에 각각 한 번씩 발송 가능.
 * 레거시 행은 `minute=NULL`이며, SQLite에서 NULL은 UNIQUE 제약상 서로 다른 값으로 취급됨.
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
    /** 발송된 reminder의 KST 분. 레거시 row는 NULL. */
    minute: integer("minute"),
  },
  (t) => ({
    uniq: uniqueIndex("notifications_user_date_type_minute").on(
      t.userKey,
      t.date,
      t.type,
      t.minute,
    ),
  }),
);
