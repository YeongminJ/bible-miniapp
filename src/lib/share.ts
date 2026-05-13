import { share, getTossShareLink } from "@apps-in-toss/web-framework";
import { getDisplayName } from "./user-name";

// granite.config.ts 의 appName 과 일치시켜야 해요
const APP_NAME = "bible-mini";

/**
 * 공유 메시지에 "{이름}님" prefix를 붙인다.
 * 캐시된 표시 이름이 없으면 fallback 메시지 그대로 사용.
 *
 * @example
 * personalize({
 *   withName: (name) => `📖 ${name}님이 받은 오늘의 말씀`,
 *   fallback: `📖 오늘의 말씀`,
 * })
 */
export function personalize(opts: {
  withName: (name: string) => string;
  fallback: string;
}): string {
  const name = getDisplayName();
  return name ? opts.withName(name) : opts.fallback;
}

/**
 * 토스 공유 링크를 만들고 네이티브 공유 시트를 띄워요.
 * 미지원 환경(브라우저 등)에선 navigator.share → navigator.clipboard 순서로 폴백해요.
 */
export async function shareMessage(message: string, path = `intoss://${APP_NAME}`): Promise<{ ok: boolean }>{
  try {
    let link = "";
    try {
      link = await getTossShareLink(path);
    } catch {
      link = "";
    }
    const text = link ? `${message}\n${link}` : message;
    try {
      await share({ message: text });
      return { ok: true };
    } catch {
      // 네이티브 share 실패 시 폴백
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ text });
        return { ok: true };
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return { ok: true };
      }
      return { ok: false };
    }
  } catch {
    return { ok: false };
  }
}
