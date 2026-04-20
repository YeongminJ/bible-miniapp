import { loadFullScreenAd, showFullScreenAd } from "@apps-in-toss/web-framework";

// 앱인토스 콘솔에서 생성한 전면광고 광고 그룹 ID로 교체해야 해요.
// 필요 시 .env 에 VITE_AD_GROUP_ID 지정하면 우선 사용.
const AD_GROUP_ID =
  (import.meta.env.VITE_AD_GROUP_ID as string | undefined) ??
  "toss-full-screen-ad-placeholder";

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

// 전면광고 보여주고 닫힐 때까지 대기. 브라우저/미지원 환경에선 즉시 resolve.
export async function showInterstitialAd(): Promise<{ shown: boolean }> {
  if (!isAdSupported()) {
    console.info("[ad] fullscreen ad not supported — skipping");
    return { shown: false };
  }

  return new Promise<{ shown: boolean }>((resolve) => {
    let unsubscribeLoad: (() => void) | null = null;
    let unsubscribeShow: (() => void) | null = null;
    const cleanup = () => {
      unsubscribeLoad?.();
      unsubscribeShow?.();
    };

    unsubscribeLoad = loadFullScreenAd({
      options: { adGroupId: AD_GROUP_ID },
      onEvent: (e) => {
        if (e.type === "loaded") {
          unsubscribeShow = showFullScreenAd({
            options: { adGroupId: AD_GROUP_ID },
            onEvent: (se) => {
              if (se.type === "dismissed" || se.type === "failedToShow") {
                cleanup();
                resolve({ shown: se.type === "dismissed" });
              }
            },
            onError: () => {
              cleanup();
              resolve({ shown: false });
            },
          });
        }
      },
      onError: () => {
        cleanup();
        resolve({ shown: false });
      },
    });
  });
}
