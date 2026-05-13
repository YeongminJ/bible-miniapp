// 누적 포인트 적립 + 수령 임계값 정책.
// 정책:
//  - 하루 한 번, 사용자가 미션 3개 모두 완료 후 "받기" 버튼을 누르면 광고 시청 → 1~5원 가중 랜덤 적립
//  - 누적 잔액(`balance`) >= 10이면 수령 버튼 활성화
//  - 수령 시 SDK `grantPromotionReward(amount=balance)` 호출 → 성공 시 balance를 0으로 리셋,
//    `claimedTotal`에 누적 추가
//
// 모든 상태는 localStorage. 서버 동기화는 안 함 (단말이 바뀌면 잔액 리셋됨 — MVP).

const KEY = "userPoints.v1";

export const CLAIM_THRESHOLD = 10;

/**
 * 일일 보상 금액 분포 (1~5원).
 *  1원 40%, 2원 30%, 3원 15%, 4원 10%, 5원 5%
 */
export function rollDailyReward(): number {
  const r = Math.random();
  if (r < 0.4) return 1;
  if (r < 0.7) return 2;
  if (r < 0.85) return 3;
  if (r < 0.95) return 4;
  return 5;
}

export interface PointsState {
  /** 미수령 누적 잔액 (원/포인트). 수령 시 0으로 리셋. */
  balance: number;
  /** 지금까지 수령에 성공한 총 포인트. 수령 시마다 누적. */
  claimedTotal: number;
  /** 마지막으로 적립한 KST 날짜 (YYYY-MM-DD). 같은 날 중복 적립 방지. */
  lastEarnedDate: string | null;
  /** 마지막 적립 금액 (오늘 받은 금액 표시용). */
  lastEarnedAmount?: number;
}

function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fresh(): PointsState {
  return { balance: 0, claimedTotal: 0, lastEarnedDate: null };
}

function load(): PointsState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<PointsState>;
    return {
      balance: typeof parsed.balance === "number" ? parsed.balance : 0,
      claimedTotal:
        typeof parsed.claimedTotal === "number" ? parsed.claimedTotal : 0,
      lastEarnedDate:
        typeof parsed.lastEarnedDate === "string"
          ? parsed.lastEarnedDate
          : null,
      lastEarnedAmount:
        typeof parsed.lastEarnedAmount === "number"
          ? parsed.lastEarnedAmount
          : undefined,
    };
  } catch {
    return fresh();
  }
}

function save(s: PointsState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function emitChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent("points:changed"));
  } catch {
    /* ignore */
  }
}

export function getPointsState(): PointsState {
  return load();
}

/**
 * 오늘 amount원 적립. 같은 날 이미 적립됐으면 noop.
 *
 * @param amount 적립할 금액 (1 이상 정수)
 * @returns 이번 호출로 새로 적립이 발생했는지 + 최신 상태
 */
export function earnPointForToday(
  amount: number,
): { earned: boolean; state: PointsState } {
  const s = load();
  const today = todayKey();
  if (s.lastEarnedDate === today) return { earned: false, state: s };
  const safeAmount = Math.max(1, Math.floor(amount));
  const next: PointsState = {
    ...s,
    balance: s.balance + safeAmount,
    lastEarnedDate: today,
    lastEarnedAmount: safeAmount,
  };
  save(next);
  emitChanged();
  return { earned: true, state: next };
}

/**
 * 수령 성공 직후 호출. 잔액을 amount만큼 차감하고 claimedTotal에 더한다.
 * 보통 amount는 grantPromotionReward에 보낸 값(= 호출 직전 balance) 그대로.
 */
export function applyClaim(amount: number): PointsState {
  const s = load();
  const next: PointsState = {
    ...s,
    balance: Math.max(0, s.balance - amount),
    claimedTotal: s.claimedTotal + amount,
  };
  save(next);
  emitChanged();
  return next;
}

export function isClaimable(s: PointsState = load()): boolean {
  return s.balance >= CLAIM_THRESHOLD;
}

/** 오늘 이미 적립을 받았는지. */
export function isEarnedToday(s: PointsState = load()): boolean {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const today = `${d.getFullYear()}-${m}-${day}`;
  return s.lastEarnedDate === today;
}

/**
 * 오늘 적립 기록만 초기화. 잔액(`balance`)과 누적 수령(`claimedTotal`)은 보존.
 * 미션 리롤 시 호출 — 새로 3개를 완료하면 다시 광고 보고 적립할 수 있도록.
 */
export function resetDailyEarn(): PointsState {
  const s = load();
  if (s.lastEarnedDate === null && s.lastEarnedAmount === undefined) return s;
  const next: PointsState = {
    ...s,
    lastEarnedDate: null,
    lastEarnedAmount: undefined,
  };
  save(next);
  emitChanged();
  return next;
}
