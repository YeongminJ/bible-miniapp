import { loadFullScreenAd, showFullScreenAd } from "@apps-in-toss/web-framework";

// 앱인토스 콘솔에서 발급한 전면광고 광고 그룹 ID (v2 live).
// 필요 시 .env 의 VITE_AD_GROUP_ID 로 덮어쓸 수 있어요.
const AD_GROUP_ID =
  (import.meta.env.VITE_AD_GROUP_ID as string | undefined) ??
  "ait.v2.live.c9e7e5f5fd554e91";

// 리워드형 광고용 (통독 듣기 진입 시 사용 예정).
// 키 미발급 상태면 undefined → showInterstitialAd가 기본 광고로 fallback.
// 키 발급 후 .env 에 VITE_REWARD_AD_GROUP_ID 를 채우면 자동 적용.
export const REWARD_AD_GROUP_ID: string | undefined =
  (import.meta.env.VITE_REWARD_AD_GROUP_ID as string | undefined) || undefined;

const LOAD_TIMEOUT_MS = 6000; // 광고 로드 대기 한계
const SHOW_TIMEOUT_MS = 30000; // 광고 노출~닫힘 대기 한계 (사용자가 안 닫는 경우 안전망)

export type AdResult =
  | { shown: true }
  | { shown: false; reason: "unsupported" | "load-timeout" | "load-error" | "show-timeout" | "show-failed" | "show-error" };

function isAdSupported(): boolean {
  try {
    return (
      typeof loadFullScreenAd?.isSupported === "function" &&
      loadFullScreenAd.isSupported() &&
      typeof showFullScreenAd?.isSupported === "function" &&
      showFullScreenAd.isSupported()
    );
  } catch {
    return false;
  }
}

// 전면광고 보여주고 닫힐 때까지 대기.
// 항상 정해진 시간 안에 resolve — 미지원/실패/타임아웃 시 reason 반환.
// options.adGroupId 를 주면 해당 광고 그룹을 사용 (리워드용 등). 안 주면 기본 전면광고.
export async function showInterstitialAd(
  options?: { adGroupId?: string },
): Promise<AdResult> {
  if (!isAdSupported()) {
    console.info("[ad] fullscreen ad not supported — skipping");
    return { shown: false, reason: "unsupported" };
  }
  const adGroupId = options?.adGroupId ?? AD_GROUP_ID;

  return new Promise<AdResult>((resolve) => {
    let unsubscribeLoad: (() => void) | null = null;
    let unsubscribeShow: (() => void) | null = null;
    let loadTimer: ReturnType<typeof setTimeout> | null = null;
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const cleanup = () => {
      try { unsubscribeLoad?.(); } catch { /* noop */ }
      try { unsubscribeShow?.(); } catch { /* noop */ }
      if (loadTimer) clearTimeout(loadTimer);
      if (showTimer) clearTimeout(showTimer);
    };

    const settle = (r: AdResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(r);
    };

    // 로드 타임아웃
    loadTimer = setTimeout(() => {
      console.warn("[ad] load timeout");
      settle({ shown: false, reason: "load-timeout" });
    }, LOAD_TIMEOUT_MS);

    try {
      unsubscribeLoad = loadFullScreenAd({
        options: { adGroupId },
        onEvent: (e) => {
          if (e.type !== "loaded") return;
          if (loadTimer) { clearTimeout(loadTimer); loadTimer = null; }

          // 노출 타임아웃 (보통은 dismissed로 종료되지만 안전망)
          showTimer = setTimeout(() => {
            console.warn("[ad] show timeout");
            settle({ shown: false, reason: "show-timeout" });
          }, SHOW_TIMEOUT_MS);

          try {
            unsubscribeShow = showFullScreenAd({
              options: { adGroupId },
              onEvent: (se) => {
                if (se.type === "dismissed") settle({ shown: true });
                else if (se.type === "failedToShow") settle({ shown: false, reason: "show-failed" });
              },
              onError: (err) => {
                console.warn("[ad] show error", err);
                settle({ shown: false, reason: "show-error" });
              },
            });
          } catch (err) {
            console.warn("[ad] show throw", err);
            settle({ shown: false, reason: "show-error" });
          }
        },
        onError: (err) => {
          console.warn("[ad] load error", err);
          settle({ shown: false, reason: "load-error" });
        },
      });
    } catch (err) {
      console.warn("[ad] load throw", err);
      settle({ shown: false, reason: "load-error" });
    }
  });
}
