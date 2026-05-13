// 기능성 푸시 알림 구독/해지 API (Cloudflare Worker)
// Worker: https://bible-mini-noti-api.hohostd.workers.dev
// - POST   /api/users                  { userKey, reminders: number[] }         → 구독 (다중 시각)
// - DELETE /api/users                  { userKey }                              → 해지
// - POST   /api/auth/migration/status  { hash }                                 → 매핑 여부 확인
// - POST   /api/auth/migration/link    { hash, authorizationCode, referrer }    → 토스 OAuth 매핑 저장
//
// reminders는 자정 기준 분(0~1439) 배열. 예: ["10:00","20:00"] → [600, 1200].
// 빈 배열을 보내면 모든 알림 비활성. 서버는 user_reminders를 통째로 교체(replace-all).
// userKey 는 클라 hash (getAnonymousKey 결과). 토스 OAuth로 받은 별도 키와
// 매핑은 서버 `users.toss_user_key` 컬럼이 관리. 클라는 hash만 알면 됨.

import {
  clearMappingVerified,
  markMappingVerified,
} from "./mapping-cache";
import {
  getDisplayName,
  hasTriedRefetchThisSession,
  markRefetchTriedThisSession,
  setDisplayName,
} from "./user-name";

const BASE = "https://bible-mini-noti-api.hohostd.workers.dev";

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * 다중 알림 시각 구독 (replace-all 의미).
 * 빈 배열을 넘기면 모든 알림 비활성.
 * 서버는 user_reminders 테이블을 받은 배열로 통째로 교체.
 */
export async function subscribeNotify(
  userKey: string,
  times: string[],
): Promise<{ ok: boolean }> {
  try {
    const reminders = Array.from(
      new Set(times.map((t) => timeToMinutes(t))),
    ).sort((a, b) => a - b);
    const res = await fetch(`${BASE}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userKey, reminders }),
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
    const ok = Boolean(j?.ok);
    if (ok) clearMappingVerified();
    return { ok };
  } catch {
    return { ok: false };
  }
}

/**
 * hash로 사용자가 토스 OAuth 매핑됐는지 조회.
 *  - `ok=true, isMapped=true`  : 서버가 매핑 확인 → 플래그 캐시 업데이트
 *  - `ok=true, isMapped=false` : 서버가 명확히 미매핑이라 회신 → 복구 흐름 트리거 가능
 *  - `ok=false`                : 네트워크/서버 오류. 매핑 상태 불명. 복구 흐름 금지.
 */
export async function checkMappingStatus(
  hash: string,
): Promise<{ isMapped: boolean; ok: boolean }> {
  try {
    const res = await fetch(`${BASE}/api/auth/migration/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash }),
    });
    if (!res.ok) return { isMapped: false, ok: false };
    const j = await res.json().catch(() => null);
    if (j == null) return { isMapped: false, ok: false };
    const isMapped = Boolean(j?.isMapped);
    if (isMapped) markMappingVerified();
    return { isMapped, ok: true };
  } catch {
    return { isMapped: false, ok: false };
  }
}

/**
 * `appLogin()` 인가코드를 서버로 넘겨 hash↔토스 userKey 매핑 저장.
 * 한 번 성공하면 그 hash로는 다시 OAuth 안 띄워도 됨.
 *
 * 응답에 `name`이 있으면 user_name scope 동의된 사용자임 — 클라에서 공유 메시지 prefix로 활용.
 */
export async function createMapping(
  hash: string,
  authorizationCode: string,
  referrer: string,
): Promise<{ ok: boolean; name?: string }> {
  try {
    const res = await fetch(`${BASE}/api/auth/migration/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash, authorizationCode, referrer }),
    });
    const j = await res.json().catch(() => ({}));
    const ok = Boolean(j?.success);
    if (ok) {
      markMappingVerified();
      const n = typeof j?.name === "string" ? j.name : undefined;
      if (n) setDisplayName(n);
    }
    return { ok, name: typeof j?.name === "string" ? j.name : undefined };
  } catch {
    return { ok: false };
  }
}

/**
 * 서버에 저장된 사용자 프로필 조회. name이 채워져 있으면 클라 캐시 동기화.
 */
export async function fetchUserProfile(
  hash: string,
): Promise<{ name: string | null; tossUserKey: string | null } | null> {
  try {
    const res = await fetch(`${BASE}/api/users/${encodeURIComponent(hash)}`);
    if (!res.ok) return null;
    const j = (await res.json().catch(() => null)) as
      | { user?: { name?: string | null; tossUserKey?: string | null } }
      | null;
    if (!j?.user) return null;
    const name = typeof j.user.name === "string" ? j.user.name : null;
    return {
      name,
      tossUserKey:
        typeof j.user.tossUserKey === "string" ? j.user.tossUserKey : null,
    };
  } catch {
    return null;
  }
}

/**
 * 표시 이름이 캐시에 없으면 서버에서 가져오고, 그래도 없으면 1회 silent appLogin으로 보충.
 *
 * - 캐시 hit: 즉시 반환
 * - 캐시 miss + 서버에 name 있음: 캐시에 저장 후 반환
 * - 캐시 miss + 서버에 name 없음 + 사용자가 매핑됐음: silent appLogin → /migration/link → name backfill
 *   (기존 OAuth 동의가 있는 사용자는 UI 안 뜨고 즉시 인가코드 발급됨)
 *
 * 한 세션 1회만 silent OAuth 시도 (sessionStorage 가드).
 */
export async function ensureUserName(hash: string): Promise<string | null> {
  const cached = getDisplayName();
  if (cached) return cached;

  const profile = await fetchUserProfile(hash);
  if (profile?.name) {
    setDisplayName(profile.name);
    return profile.name;
  }

  // 매핑 안 된 사용자는 OAuth 자체가 의미 없음
  if (!profile?.tossUserKey) return null;

  // 한 세션 1회만 silent backfill 시도
  if (hasTriedRefetchThisSession()) return null;
  markRefetchTriedThisSession();

  try {
    const framework = await import("@apps-in-toss/web-framework");
    if (!framework.appLogin) return null;
    const { authorizationCode, referrer } = await framework.appLogin();
    const { name } = await createMapping(hash, authorizationCode, referrer);
    if (name) {
      setDisplayName(name);
      return name;
    }
  } catch (err) {
    console.warn("[notify-api] ensureUserName backfill failed", err);
  }
  return null;
}

/**
 * 푸시 등록 직전에 호출. 매핑 안 되어있으면 `appLogin()` 트리거 → 서버에 매핑 저장.
 * 이미 매핑돼있거나 토스 로그인 미연동 미니앱이면 즉시 true 반환.
 *
 * 동시 호출 보호: 진행 중이면 같은 promise 반환해서 `appLogin()` 두 번 뜨는 거 방지.
 *
 * 반환:
 *  - true: 매핑 완료 (또는 이미 매핑됨)
 *  - false: appLogin 실패/거절 또는 서버 매핑 실패 (호출자는 구독은 그대로 진행해도 됨,
 *           cron 발송 단계에서 toss_user_key 없는 사용자는 자동 skip)
 */
let _mappingInflight: Promise<boolean> | null = null;
export function ensureMapped(hash: string): Promise<boolean> {
  if (_mappingInflight) return _mappingInflight;
  _mappingInflight = (async () => {
    try {
      const { isMapped } = await checkMappingStatus(hash);
      if (isMapped) return true;

      const framework = await import("@apps-in-toss/web-framework");
      if (!framework.appLogin) return false;

      const { authorizationCode, referrer } = await framework.appLogin();
      const { ok } = await createMapping(hash, authorizationCode, referrer);
      return ok;
    } catch (err) {
      console.warn("[notify-api] ensureMapped failed", err);
      return false;
    } finally {
      _mappingInflight = null;
    }
  })();
  return _mappingInflight;
}
