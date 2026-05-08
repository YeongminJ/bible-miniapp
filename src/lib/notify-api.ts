// 기능성 푸시 알림 구독/해지 API (Cloudflare Worker)
// Worker: https://bible-mini-noti-api.hohostd.workers.dev
// - POST /api/users   { userKey, reminderMinute }  → 구독
// - DELETE /api/users { userKey }                  → 해지
// reminderMinute 는 자정 기준 분(0~1439). 예: "10:00" → 600

const BASE = "https://bible-mini-noti-api.hohostd.workers.dev";

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export async function subscribeNotify(
  userKey: string,
  time: string,
): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${BASE}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userKey, reminderMinute: timeToMinutes(time) }),
    });
    const j = await res.json().catch(() => ({}));
    return { ok: Boolean(j?.ok) };
  } catch {
    return { ok: false };
  }
}

export async function unsubscribeNotify(
  userKey: string,
): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${BASE}/api/users`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userKey }),
    });
    const j = await res.json().catch(() => ({}));
    return { ok: Boolean(j?.ok) };
  } catch {
    return { ok: false };
  }
}
