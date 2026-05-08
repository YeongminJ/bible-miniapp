import { getAnonymousKey } from "@apps-in-toss/web-framework";

const CACHE_KEY = "anonymousKey.v1";

/**
 * 토스 익명 사용자 키(HASH) 가져오기.
 * - 첫 호출 시 SDK 호출 + localStorage 캐시
 * - 이후엔 캐시 사용
 * - 미지원 환경(브라우저 등)은 null 반환
 */
export async function ensureUserKey(): Promise<string | null> {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return cached;
  } catch { /* ignore */ }

  try {
    const result = await getAnonymousKey();
    if (result && typeof result === "object" && result.type === "HASH" && result.hash) {
      try { localStorage.setItem(CACHE_KEY, result.hash); } catch { /* ignore */ }
      return result.hash;
    }
  } catch { /* ignore */ }

  return null;
}
