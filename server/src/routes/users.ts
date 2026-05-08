import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client";
import { notifications, users } from "../db/schema";
import type { Env } from "../env";
import { kstDateFromEpoch, dayDiff, nowKstDate } from "../lib/time";

const upsertSchema = z.object({
  userKey: z.string().min(1).max(200),
  /** 알림 받을 KST 분 (0~1439). null이면 모든 푸시 비활성. */
  reminderMinute: z.number().int().min(0).max(1439).nullable(),
  dailyEnabled: z.boolean().default(true),
  streakWarnEnabled: z.boolean().default(true),
  timezone: z.string().default("Asia/Seoul"),
});

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
 */
route.post("/", zValidator("json", upsertSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);
  const now = Date.now();

  await db
    .insert(users)
    .values({
      userKey: body.userKey,
      reminderMinute: body.reminderMinute,
      dailyEnabled: body.dailyEnabled,
      streakWarnEnabled: body.streakWarnEnabled,
      timezone: body.timezone,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.userKey,
      set: {
        reminderMinute: body.reminderMinute,
        dailyEnabled: body.dailyEnabled,
        streakWarnEnabled: body.streakWarnEnabled,
        timezone: body.timezone,
        updatedAt: now,
      },
    });

  return c.json({
    ok: true,
    userKey: body.userKey,
    reminderMinute: body.reminderMinute,
  });
});

/**
 * 사용자 + 발송 이력 모두 삭제 (opt-out).
 */
route.delete("/", zValidator("json", deleteSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c.env.DB);
  await db
    .delete(notifications)
    .where(eq(notifications.userKey, body.userKey));
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
 * 사용자 정보 조회. 디버깅용.
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
  return c.json({ user });
});

export default route;
