// 일일 미션 (3종): 오늘의 말씀 듣기 / 퀴즈 정답 1개 / 기도 따라읽기 또는 아멘
const KEY = "dailyMissions.v1";

export type MissionId = "verse" | "quiz" | "prayer";

export interface MissionsState {
  date: string; // YYYY-MM-DD
  done: Record<MissionId, boolean>;
}

function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fresh(): MissionsState {
  return { date: todayKey(), done: { verse: false, quiz: false, prayer: false } };
}

function load(): MissionsState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MissionsState;
      if (parsed.date === todayKey()) return parsed;
    }
  } catch { /* ignore */ }
  return fresh();
}

function save(s: MissionsState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function getMissions(): MissionsState {
  return load();
}

export function completeMission(id: MissionId): MissionsState {
  const s = load();
  if (s.done[id]) return s;
  s.done[id] = true;
  save(s);
  // 사용자 정의 이벤트 발생 — 헤더 등에서 즉시 갱신
  try {
    window.dispatchEvent(new CustomEvent("missions:changed"));
  } catch { /* ignore */ }
  return s;
}

export function missionsDoneCount(s: MissionsState): number {
  return Object.values(s.done).filter(Boolean).length;
}
