// 토스 프로모션(토스 포인트) 지급 래퍼.
// SDK의 `grantPromotionReward`를 사용해 클라에서 직접 사용자에게 포인트를 지급한다.
// 콘솔에 등록·승인된 비게임 프로모션 코드와 1회 지급 금액 한도가 필요.
//
// 환경변수로 코드를 주입하면 dev/prod 분리 가능:
//   VITE_DAILY_MISSION_PROMOTION_CODE=...
//   VITE_DAILY_MISSION_REWARD_AMOUNT=100
//
// 환경변수가 없으면 PLACEHOLDER가 사용되며 SDK가 4100(프로모션 정보 없음) 에러를 반환한다.

import { grantPromotionReward } from "@apps-in-toss/web-framework";

const PLACEHOLDER_CODE = "DAILY_MISSION_REWARD";

const RAW_CODE = import.meta.env.VITE_DAILY_MISSION_PROMOTION_CODE as
  | string
  | undefined;

export const PROMOTION_CODE: string = RAW_CODE ?? PLACEHOLDER_CODE;

export const REWARD_AMOUNT: number = (() => {
  const raw = import.meta.env.VITE_DAILY_MISSION_REWARD_AMOUNT as string | undefined;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 100;
})();

/**
 * 토스 콘솔에서 발급받은 프로모션 코드가 빌드 환경에 주입돼있는지.
 * 미주입(`undefined`) 또는 placeholder면 false → UI에서 보상 영역을 숨김.
 */
export function isPromotionConfigured(): boolean {
  return Boolean(RAW_CODE) && RAW_CODE !== PLACEHOLDER_CODE;
}

export type GrantOk = { ok: true; key?: string };
export type GrantErr = {
  ok: false;
  /** SDK error code(`4100`,`4113` 등) 또는 `'ERROR'`/`'UNSUPPORTED'`/`'EXCEPTION'` */
  code: string;
  message?: string;
};
export type GrantResult = GrantOk | GrantErr;

/**
 * 누적 포인트 수령. 콘솔에 등록한 비게임 프로모션 코드로 amount 만큼 지급.
 * 호출 측에서 잔액(`isClaimable`) 확인 후 amount를 전달할 것.
 *
 * @param amount 지급할 금액(원/포인트). 미지정 시 `REWARD_AMOUNT` env 기본값.
 */
export async function grantDailyMissionReward(
  amount: number = REWARD_AMOUNT,
): Promise<GrantResult> {
  try {
    const result = await grantPromotionReward({
      params: {
        promotionCode: PROMOTION_CODE,
        amount,
      },
    });

    if (!result) {
      return { ok: false, code: "UNSUPPORTED", message: "지원하지 않는 앱 버전이에요." };
    }
    if (result === "ERROR") {
      return { ok: false, code: "ERROR", message: "포인트 지급 중 오류가 발생했어요." };
    }
    if ("key" in result) {
      return { ok: true, key: result.key };
    }
    if ("errorCode" in result) {
      return { ok: false, code: result.errorCode, message: result.message };
    }
    // 알려지지 않은 응답 형태
    return { ok: false, code: "UNKNOWN", message: "알 수 없는 응답이에요." };
  } catch (err) {
    return {
      ok: false,
      code: "EXCEPTION",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/** SDK error code → 사용자 노출 메시지 */
export function describeGrantError(code: string, message?: string): string {
  switch (code) {
    case "4100":
      return "프로모션 정보를 찾을 수 없어요.";
    case "4104":
      return "프로모션이 잠시 중지됐어요.";
    case "4105":
      return "프로모션이 종료됐어요.";
    case "4108":
      return "프로모션 승인을 기다리는 중이에요.";
    case "4109":
      return "프로모션이 아직 시작되지 않았어요.";
    case "4110":
      return "지금은 포인트를 받을 수 없어요.";
    case "4112":
      return "프로모션 예산이 모두 소진됐어요.";
    case "4113":
      return "이미 받은 포인트예요.";
    case "4114":
      return "1회 지급 한도를 초과했어요.";
    case "UNSUPPORTED":
      return "토스앱 버전을 업데이트해 주세요.";
    case "EXCEPTION":
    case "ERROR":
    case "UNKNOWN":
    default:
      return message ?? "포인트 지급에 실패했어요. 잠시 후 다시 시도해 주세요.";
  }
}
