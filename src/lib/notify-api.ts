// 기능성 푸시 알림 구독/해지 API (Cloudflare Worker)
// Worker: https://bible-mini-noti-api.hohostd.workers.dev
// - POST   /api/users                  { userKey, reminderMinute }              → 구독
// - DELETE /api/users                  { userKey }                              → 해지
// - POST   /api/auth/migration/status  { hash }                                 → 매핑 여부 확인
// - POST   /api/auth/migration/link    { hash, authorizationCode, referrer }    → 토스 OAuth 매핑 저장
//
// reminderMinute 는 자정 기준 분(0~1439). 예: "10:00" → 600.
// userKey 는 클라 hash (getAnonymousKey 결과). 토스 OAuth로 받은 별도 키와
// 매핑은 서버 `users.toss_user_key` 컬럼이 관리. 클라는 hash만 알면 됨.

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

/** hash로 사용자가 토스 OAuth 매핑됐는지 조회. */
export async function checkMappingStatus(
  hash: string,
): Promise<{ isMapped: boolean }> {
  try {
    const res = await fetch(`${BASE}/api/auth/migration/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash }),
    });
    const j = await res.json().catch(() => ({}));
    return { isMapped: Boolean(j?.isMapped) };
  } catch {
    return { isMapped: false };
  }
}

/**
 * `appLogin()` 인가코드를 서버로 넘겨 hash↔토스 userKey 매핑 저장.
 * 한 번 성공하면 그 hash로는 다시 OAuth 안 띄워도 됨.
 */
export async function createMapping(
  hash: string,
  authorizationCode: string,
  referrer: string,
): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${BASE}/api/auth/migration/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash, authorizationCode, referrer }),
    });
    const j = await res.json().catch(() => ({}));
    return { ok: Boolean(j?.success) };
  } catch {
    return { ok: false };
  }
}

/**
 * 푸시 등록 직전에 호출. 매핑 안 되어있으면 `appLogin()` 트리거 → 서버에 매핑 저장.
 * 이미 매핑돼있거나 토스 로그인 미연동 미니앱이면 즉시 true 반환.
 *
 * 반환:
 *  - true: 매핑 완료 (또는 이미 매핑됨, 또는 미연동 → 발송 불가지만 흐름은 정상)
 *  - false: appLogin 실패/거절 또는 서버 매핑 실패
 */
export async function ensureMapped(hash: string): Promise<boolean> {
  const { isMapped } = await checkMappingStatus(hash);
  if (isMapped) return true;

  try {
    const framework = await import("@apps-in-toss/web-framework");
    // 토스 로그인 미연동 미니앱이면 OAuth 자체가 불가능 — 매핑 생략
    if (!framework.appLogin) return false;
    const { authorizationCode, referrer } = await framework.appLogin();
    const { ok } = await createMapping(hash, authorizationCode, referrer);
    return ok;
  } catch (err) {
    console.warn("[notify-api] ensureMapped failed", err);
    return false;
  }
}
