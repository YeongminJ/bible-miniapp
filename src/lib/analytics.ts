import { Analytics } from "@apps-in-toss/web-framework";

type Primitive = string | number | boolean | null | undefined;
type Params = Record<string, Primitive>;

function safe(fn: () => unknown) {
  try {
    const r = fn();
    // Promise rejection 무시 (SDK 내부 에러가 앱 흐름을 끊지 않도록)
    if (r && typeof (r as Promise<unknown>).then === "function") {
      (r as Promise<unknown>).catch(() => {});
    }
  } catch {
    // Analytics 미지원 환경 등 — 조용히 무시
  }
}

function clean(params?: Params): Params {
  if (!params) return {};
  const out: Params = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    out[k] = v;
  }
  return out;
}

export const track = {
  /** 화면 진입/전환 */
  screen(name: string, params?: Params) {
    safe(() => Analytics.screen({ log_name: name, ...clean(params) }));
  },
  /** 사용자 액션(클릭·선택·제출 등) */
  click(name: string, params?: Params) {
    safe(() => Analytics.click({ log_name: name, ...clean(params) }));
  },
  /** 요소/결과 노출(결과 모달, 광고 결과, 에러 표시 등) */
  impression(name: string, params?: Params) {
    safe(() => Analytics.impression({ log_name: name, ...clean(params) }));
  },
};
