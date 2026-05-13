import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client";
import { notifications, userReminders, users } from "../db/schema";
import type { Env } from "../env";
import { kstDateFromEpoch, dayDiff, nowKstDate } from "../lib/time";

/**
 * v0.3 multi-reminder API.
 *  - `reminders`(권장): 0~1439 분의 배열. 빈 배열이면 모든 알림 비활성.
 *  - `reminderMinute`(레거시): 단일 분 또는 null. 호환성을 위해 계속 받지만 내부적으로 reminders로 변환.
 * 둘 다 안 주면 알림 설정은 변경하지 않음(등록만).
 */
const upsertSchema = z
  .object({
    userKey: z.string().min(1).max(200),
    /** 알림 받을 KST 분 배열 (0~1439). 빈 배열이면 모든 알림 비활성. */
    reminders: z.array(z.number().int().min(0).max(1439)).optional(),
    /** @deprecated. 단일 분 또는 null. reminders 미지정 시에만 사용. */
    reminderMinute: z.number().int().min(0).max(1439).nullable().optional(),
    dailyEnabled: z.boolean().default(true),
    streakWarnEnabled: z.boolean().default(true),
    timezone: z.string().default("Asia/Seoul"),
  })
  .refine(
    (v) => v.reminders !== undefined || v.reminderMinute !== undefined,
    { message: "reminders 또는 reminderMinute 중 하나는 제공해야 합니다." },
  );

const deleteSchema = z.object({
  userKey: z.string().min(1).max(200),
});

const playSchema = z.object({
  /** 플레이 시각(epoch ms). 생략 시 서버 현재 시각. */
  playedAt: z.number().int().positive().optional(),
});

const route = new Hono<{ Bindings: Env }>();

/**
 * 사용자 등록/업데이트 (upsert).
 * 클라가 알림 설정 화면 진입/변경 시 호출.
 *
 * 동작:
 *  1. users 테이블 upsert (reminderMinute 컬럼은 레거시 호환용으로 첫 reminder 값 미러링)
 *  2. user_reminders를 받은 reminders 배열로 교체(전체 delete + bulk insert)
 *
 * 트랜잭션: D1은 batch 단위 atomic이지만 raw SQL과 drizzle 혼용은 까다로움.
 * 우리는 1개 사용자만 다루므로 두 단계 시퀀스가 실패하더라도 영향 범위 작음.
 * users는 upsert(idempotent), user_reminders는 delete+insert(idempotent).
 */
route.post("/", zValidator("json", upsertSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);
  const now = Date.now();

  // 정규화: reminders 우선, 없으면 reminderMinute(legacy) 단일 → 배열 변환.
  const remindersRaw =
    body.reminders ??
    (body.reminderMinute == null ? [] : [body.reminderMinute]);
  // 중복 제거 + 정렬
  const reminders = Array.from(new Set(remindersRaw)).sort((a, b) => a - b);
  const legacyMirror = reminders.length > 0 ? reminders[0] : null;

  await db
    .insert(users)
    .values({
      userKey: body.userKey,
      reminderMinute: legacyMirror,
      dailyEnabled: body.dailyEnabled,
      streakWarnEnabled: body.streakWarnEnabled,
      timezone: body.timezone,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.userKey,
      set: {
        reminderMinute: legacyMirror,
        dailyEnabled: body.dailyEnabled,
        streakWarnEnabled: body.streakWarnEnabled,
        timezone: body.timezone,
        updatedAt: now,
      },
    });

  // user_reminders 동기화: 통째로 교체
  await db
    .delete(userReminders)
    .where(eq(userReminders.userKey, body.userKey));
  if (reminders.length > 0) {
    await db
      .insert(userReminders)
      .values(
        reminders.map((minute) => ({
          userKey: body.userKey,
          minute,
          createdAt: now,
        })),
      );
  }

  return c.json({
    ok: true,
    userKey: body.userKey,
    reminders,
  });
});

/**
 * 사용자 + 발송 이력 + reminder 모두 삭제 (opt-out).
 */
route.delete("/", zValidator("json", deleteSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);
  await db
    .delete(notifications)
    .where(eq(notifications.userKey, body.userKey));
  await db
    .delete(userReminders)
    .where(eq(userReminders.userKey, body.userKey));
  await db.delete(users).where(eq(users.userKey, body.userKey));
  return c.json({ ok: true });
});

/**
 * 플레이 트래킹.
 * 클라가 퀴즈 완료(또는 동등한 daily action) 1회 발생 시 호출.
 * - last_played_at 갱신
 * - current_streak 계산: 어제 플레이했으면 +1, 오늘 이미 플레이면 유지, 그 외 1로 리셋
 */
route.patch(
  "/:userKey/play",
  zValidator("json", playSchema),
  async (c) => {
    const userKey = c.req.param("userKey");
    const body = c.req.valid("json");
    const db = getDb(c.env.DB);

    const user = await db
      .select()
      .from(users)
      .where(eq(users.userKey, userKey))
      .get();
    if (!user) return c.json({ error: "not_found" }, 404);

    const playedAt = body.playedAt ?? Date.now();
    const todayKst = nowKstDate(new Date(playedAt));
    const prevDate = user.lastPlayedAt
      ? kstDateFromEpoch(user.lastPlayedAt)
      : null;

    let nextStreak: number;
    if (prevDate === todayKst) {
      // 같은 날 재플레이 — 스트릭 유지
      nextStreak = user.currentStreak;
    } else if (prevDate != null && dayDiff(prevDate, todayKst) === 1) {
      // 어제 플레이 → 오늘 → +1
      nextStreak = user.currentStreak + 1;
    } else {
      // 신규 또는 끊긴 후 재시작
      nextStreak = 1;
    }

    await db
      .update(users)
      .set({
        lastPlayedAt: playedAt,
        currentStreak: nextStreak,
        updatedAt: Date.now(),
      })
      .where(eq(users.userKey, userKey));

    return c.json({
      ok: true,
      userKey,
      currentStreak: nextStreak,
      lastPlayedAt: playedAt,
    });
  },
);

/**
 * 사용자 정보 조회. 디버깅용. reminders 목록 포함.
 */
route.get("/:userKey", async (c) => {
  const userKey = c.req.param("userKey");
  const db = getDb(c.env.DB);
  const user = await db
    .select()
    .from(users)
    .where(eq(users.userKey, userKey))
    .get();
  if (!user) return c.json({ error: "not_found" }, 404);
  const reminders = await db
    .select({ minute: userReminders.minute })
    .from(userReminders)
    .where(eq(userReminders.userKey, userKey))
    .all();
  return c.json({
    user,
    reminders: reminders.map((r) => r.minute).sort((a, b) => a - b),
  });
});

export default route;
