// 토스 OAuth 매핑(toss_user_key) 검증 캐시.
// 한 번 isMapped=true로 확인되면 플래그를 켜고, 이후엔 매 세션마다
// /api/auth/migration/status를 호출하지 않는다.
// 구독 해지/매핑 끊김 시에는 명시적으로 clear 호출.

const KEY = "mappingVerified.v1";
// 진단 — 한 번이라도 매핑이 verified 됐던 적이 있는지. clear되어도 보존.
const EVER_KEY = "mappingEverVerified.v1";
// 진단 — 가장 최근에 받은 anonymousKey 해시. 변경되면 reinstall/디바이스 변경 신호.
const LAST_ANON_HASH_KEY = "lastAnonHash.v1";

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
    localStorage.setItem(EVER_KEY, "1");
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

export function wasMappingEverVerified(): boolean {
  try {
    return localStorage.getItem(EVER_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberAnonHash(hash: string): void {
  try {
    localStorage.setItem(LAST_ANON_HASH_KEY, hash);
  } catch {
    /* ignore */
  }
}

export function getLastAnonHash(): string | null {
  try {
    return localStorage.getItem(LAST_ANON_HASH_KEY);
  } catch {
    return null;
  }
}
