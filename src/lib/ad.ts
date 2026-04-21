import { loadFullScreenAd, showFullScreenAd } from "@apps-in-toss/web-framework";

// 앱인토스 콘솔에서 생성한 전면광고 광고 그룹 ID로 교체해야 해요.
// 필요 시 .env 에 VITE_AD_GROUP_ID 지정하면 우선 사용.
const AD_GROUP_ID =
  (import.meta.env.VITE_AD_GROUP_ID as string | undefined) ??
  "toss-full-screen-ad-placeholder";

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
export async function showInterstitialAd(): Promise<AdResult> {
  if (!isAdSupported()) {
    console.info("[ad] fullscreen ad not supported — skipping");
    return { shown: false, reason: "unsupported" };
  }

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
        options: { adGroupId: AD_GROUP_ID },
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
              options: { adGroupId: AD_GROUP_ID },
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
