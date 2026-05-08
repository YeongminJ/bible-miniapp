/** KST 변환 유틸. 모든 시각(분, 날짜)은 KST 기준으로 저장돼요. */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toKstDate(now: Date): Date {
  return new Date(now.getTime() + KST_OFFSET_MS);
}

/** 현재 UTC 시각 → KST 분(0~1439). */
export function nowKstMinute(now = new Date()): number {
  const kst = toKstDate(now);
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

/** 현재 UTC 시각 → KST 'YYYY-MM-DD'. */
export function nowKstDate(now = new Date()): string {
  const kst = toKstDate(now);
  const y = kst.getUTCFullYear();
  const m = (kst.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = kst.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** epoch ms → KST 'YYYY-MM-DD'. */
export function kstDateFromEpoch(ms: number): string {
  return nowKstDate(new Date(ms));
}

/** 두 KST 날짜 문자열의 일수 차이 (`b - a`). 같은 날이면 0. */
export function dayDiff(a: string, b: string): number {
  const aMs = Date.parse(`${a}T00:00:00Z`);
  const bMs = Date.parse(`${b}T00:00:00Z`);
  return Math.round((bMs - aMs) / (24 * 60 * 60 * 1000));
}
