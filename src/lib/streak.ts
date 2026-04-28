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

/**
 * 앱 진입 시 호출. 오늘 이미 방문했으면 그대로,
 * 어제 방문했으면 +1, 그 전이면 1로 리셋.
 */
export function tickStreak(): StreakState {
  const today = todayKey();
  const yesterday = fmt(dateAdd(new Date(), -1));
  const s = load();
  if (s.lastDate === today) return s;
  let next: StreakState;
  if (s.lastDate === yesterday) {
    const count = s.count + 1;
    next = { count, lastDate: today, longest: Math.max(s.longest, count) };
  } else {
    next = { count: 1, lastDate: today, longest: Math.max(s.longest, 1) };
  }
  save(next);
  return next;
}

export function getStreak(): StreakState {
  return load();
}
