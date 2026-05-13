// 토스 OAuth 매핑(toss_user_key) 검증 캐시.
// 한 번 isMapped=true로 확인되면 플래그를 켜고, 이후엔 매 세션마다
// /api/auth/migration/status를 호출하지 않는다.
// 구독 해지/매핑 끊김 시에는 명시적으로 clear 호출.

const KEY = "mappingVerified.v1";

export function isMappingVerified(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markMappingVerified(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearMappingVerified(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
