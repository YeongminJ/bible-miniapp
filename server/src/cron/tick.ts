import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import { notifications, userReminders, users } from "../db/schema";
import type { Env } from "../env";
import {
  dayDiff,
  kstDateFromEpoch,
  nowKstDate,
  nowKstMinute,
} from "../lib/time";
import { getTossClient } from "../toss/factory";

import type { NotiType } from "../toss/client";

/**
 * 매 분 실행되는 cron 본체.
 *
 * v0.3 multi-reminder 지원:
 * 1. 현재 KST 분(0~1439)을 minute으로 가지는 user_reminders 행을 user JOIN으로 픽업
 *    한 사용자가 같은 분에 여러 row를 가질 일은 UNIQUE 제약상 없으므로 1:1 매핑
 * 2. 후보 사용자 상태로 발송 type 결정 (오늘 이미 플레이/스트릭/dailyEnabled 등)
 * 3. 같은 (userKey, date, type, minute)으로 이미 sent면 제외
 * 4. 토스 sendMessage 호출 + notifications에 minute 포함해 기록
 */
export async function runTick(
  env: Env,
  event: { scheduledTime: number },
): Promise<void> {
  const fired = new Date(event.scheduledTime);
  const kstMinute = nowKstMinute(fired);
  const kstDate = nowKstDate(fired);
  const db = getDb(env.DB);

  // 1) 분 일치 user_reminders → user JOIN
  const candidates = await db
    .select({
      userKey: users.userKey,
      tossUserKey: users.tossUserKey,
      dailyEnabled: users.dailyEnabled,
      streakWarnEnabled: users.streakWarnEnabled,
      lastPlayedAt: users.lastPlayedAt,
      currentStreak: users.currentStreak,
      minute: userReminders.minute,
    })
    .from(userReminders)
    .innerJoin(users, eq(users.userKey, userReminders.userKey))
    .where(eq(userReminders.minute, kstMinute))
    .all();

  if (candidates.length === 0) return;

  // 2) 각 사용자별 발송 타입 결정
  type Plan = {
    userKey: string;
    tossUserKey: string;
    type: NotiType;
    streak: number;
    minute: number;
  };
  const plans: Plan[] = [];

  for (const u of candidates) {
    if (!u.tossUserKey) continue;

    const lastPlayedDate = u.lastPlayedAt
      ? kstDateFromEpoch(u.lastPlayedAt)
      : null;

    if (lastPlayedDate === kstDate) continue; // 오늘 이미 플레이 → 보낼 이유 없음

    const hasActiveStreak =
      u.currentStreak > 0 &&
      lastPlayedDate != null &&
      dayDiff(lastPlayedDate, kstDate) === 1;

    if (hasActiveStreak && u.streakWarnEnabled) {
      plans.push({
        userKey: u.userKey,
        tossUserKey: u.tossUserKey,
        type: "streak_warn",
        streak: u.currentStreak,
        minute: u.minute,
      });
    } else if (u.dailyEnabled) {
      plans.push({
        userKey: u.userKey,
        tossUserKey: u.tossUserKey,
        type: "daily",
        streak: u.currentStreak,
        minute: u.minute,
      });
    }
  }

  if (plans.length === 0) return;

  // 3) 오늘 같은 (userKey, type, minute)으로 이미 sent된 건 제외
  const userKeys = plans.map((p) => p.userKey);
  const alreadySent = await db
    .select({
      userKey: notifications.userKey,
      type: notifications.type,
      minute: notifications.minute,
    })
    .from(notifications)
    .where(
      and(
        inArray(notifications.userKey, userKeys),
        eq(notifications.date, kstDate),
        eq(notifications.status, "sent"),
      ),
    )
    .all();
  const sentSet = new Set(
    alreadySent.map((r) => `${r.userKey}::${r.type}::${r.minute ?? ""}`),
  );
  const toSend = plans.filter(
    (p) => !sentSet.has(`${p.userKey}::${p.type}::${p.minute}`),
  );

  if (toSend.length === 0) return;

  console.log(
    "[tick]",
    JSON.stringify({
      kstDate,
      kstMinute,
      candidateCount: candidates.length,
      planCount: plans.length,
      sendCount: toSend.length,
    }),
  );

  // 4) 발송
  const toss = getTossClient(env);
  const sentTime = Date.now();

  for (const plan of toSend) {
    let result: { ok: boolean; error?: string };
    try {
      result = await toss.sendMessage({
        userKey: plan.tossUserKey,
        type: plan.type,
        context: { streak: plan.streak },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        "[tick] sendMessage threw",
        plan.userKey,
        plan.type,
        plan.minute,
        msg,
      );
      result = { ok: false, error: msg };
    }

    try {
      await db
        .insert(notifications)
        .values({
          userKey: plan.userKey,
          date: kstDate,
          type: plan.type,
          status: result.ok ? "sent" : "failed",
          sentAt: sentTime,
          error: result.ok ? null : (result.error ?? "unknown"),
          minute: plan.minute,
        })
        .onConflictDoNothing();
    } catch (err) {
      console.error(
        "[tick] notifications insert failed",
        plan.userKey,
        plan.type,
        plan.minute,
        err instanceof Error ? err.message : err,
      );
    }
  }
}
