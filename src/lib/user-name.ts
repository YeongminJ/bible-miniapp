// 토스 OAuth `user_name` scope로 받은 사용자 이름 캐시.
// 공유 메시지 등에서 "{이름}님" prefix 용도. 미동의/미매핑 사용자는 null.
//
// ⚠ 토스 login-me의 `name` 필드는 AES-256-GCM 암호문이라 그대로 저장하면
//   "LVeEJz26..."같은 base64 gibberish가 노출됨. 서버가 복호화 키 + AAD를
//   콘솔에서 받아 평문화하기 전까지는 저장하지 않는다.
//   (현재 서버 [routes/auth.ts]는 name을 undefined로 반환 — 키 발급 후 활성화)
//
// 키 버전(`v2`): 이전 v1 빌드에서 저장된 암호문 gibberish를 무시하기 위함.
//   부팅 시 v1 키는 강제 삭제 (orphan 방지).
//
// 동기화 흐름 (복호화 인프라 갖춰진 후 활성화 시):
//  1) 첫 매핑(`createMapping`) 성공 시 응답에 평문 name이 포함되면 즉시 setDisplayName.
//  2) 앱 부팅 시 캐시 없으면 GET /api/users/:hash 로 서버에서 가져옴.
//  3) 그래도 서버에 name이 없는 기존 매핑 사용자는 silent appLogin → /migration/link 재실행으로 backfill 시도.
//     (sessionStorage 가드로 한 세션 1회만 시도)

const KEY = "userName.v2";
const LEGACY_KEY = "userName.v1";
const REFETCH_TRIED_KEY = "userNameRefetchedThisSession.v2";

// v1에 저장된 암호문 gibberish를 한 번만 청소.
// 모듈 로드 시 즉시 실행 — 부작용이지만 다른 곳에서 import만 해도 안전하게 처리됨.
try {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(LEGACY_KEY);
  }
} catch {
  /* ignore */
}

export function getDisplayName(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function setDisplayName(name: string | null | undefined): void {
  try {
    if (name && name.length > 0) localStorage.setItem(KEY, name);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function clearDisplayName(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** 한 세션에 silent OAuth 재시도를 이미 했는지. 중복 시도 방지용. */
export function hasTriedRefetchThisSession(): boolean {
  try {
    return sessionStorage.getItem(REFETCH_TRIED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markRefetchTriedThisSession(): void {
  try {
    sessionStorage.setItem(REFETCH_TRIED_KEY, "1");
  } catch {
    /* ignore */
  }
}
