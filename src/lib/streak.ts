// 일일 연속 방문 카운터
const KEY = "streak.v1";

export interface StreakState {
  count: number;
  lastDate: string; // YYYY-MM-DD
  longest: number;
}

function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function dateAdd(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmt(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function load(): StreakState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { count: 0, lastDate: "", longest: 0 };
}

function save(s: StreakState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export type StreakChangeKind =
  | "same_day"   // 오늘 이미 방문 — 변동 없음
  | "first_day"  // 통계상 첫 방문
  | "extended"   // 어제 → 오늘 연속
  | "broken";    // 어제가 아니라 그 이전 → 1로 리셋 (이전 count가 >=2였을 때만)

export interface StreakTickResult {
  state: StreakState;
  kind: StreakChangeKind;
  /** broken/extended일 때 이전 count. 분석 funnel용. */
  previousCount: number;
}

/**
 * 앱 진입 시 호출. 오늘 이미 방문했으면 그대로,
 * 어제 방문했으면 +1, 그 전이면 1로 리셋.
 */
export function tickStreak(): StreakTickResult {
  const today = todayKey();
  const yesterday = fmt(dateAdd(new Date(), -1));
  const s = load();
  if (s.lastDate === today) {
    return { state: s, kind: "same_day", previousCount: s.count };
  }
  let next: StreakState;
  let kind: StreakChangeKind;
  if (s.lastDate === yesterday) {
    const count = s.count + 1;
    next = { count, lastDate: today, longest: Math.max(s.longest, count) };
    kind = "extended";
  } else {
    next = { count: 1, lastDate: today, longest: Math.max(s.longest, 1) };
    // 이전 count가 2 이상이었다면 진짜 깨진 것. 첫 방문이면 first_day.
    kind = s.count >= 2 ? "broken" : "first_day";
  }
  save(next);
  return { state: next, kind, previousCount: s.count };
}

/** 마일스톤 도달 여부 — 카운트가 새로 도달한 의미있는 숫자인지. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 365] as const;
export function reachedMilestone(count: number): number | null {
  return (STREAK_MILESTONES as readonly number[]).includes(count) ? count : null;
}

export function getStreak(): StreakState {
  return load();
}
