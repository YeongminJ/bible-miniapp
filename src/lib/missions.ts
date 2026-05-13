// 일일 미션 — v2부터 풀(MISSION_POOL)에서 매일 3개 랜덤 선택.
// "미션 추가로 수행하기" 버튼으로 active 세트를 새로운 3개로 교체 가능.
// 완료 기록(`done`)은 mission id 단위로 누적되며, 같은 id가 다음 reroll에 다시 등장하면
// 이미 완료된 상태로 보임 (기록 보존).
//
// 마이그레이션:
//  - v1 (`dailyMissions.v1`)에 done={verse,quiz,prayer}만 있던 경우 v2로 자연스럽게 흡수.
//  - v1 키는 그대로 사용하되 스키마만 확장(active 필드 추가, done은 부분 record로 변경).

const KEY = "dailyMissions.v1";

export type MissionId =
  | "verse"
  | "quiz"
  | "prayer"
  | "gratitude"
  | "character";

export interface MissionDef {
  id: MissionId;
  icon: string;
  title: string;
  desc: string;
  /** 우측 CTA 라벨 — 미완료 항목 클릭 안내 텍스트 */
  cta: string;
}

export const MISSION_POOL: MissionDef[] = [
  {
    id: "verse",
    icon: "📖",
    title: "오늘의 말씀 듣기",
    desc: "탭하면 자동으로 재생돼요",
    cta: "지금 듣기",
  },
  {
    id: "quiz",
    icon: "🎯",
    title: "초급 퀴즈 모두 풀기",
    desc: "쉬움 난이도 5문제 끝까지 완료",
    cta: "풀러 가기",
  },
  {
    id: "prayer",
    icon: "🙏",
    title: "기도 1편 아멘하기",
    desc: "탭하면 기도 탭으로 이동해요",
    cta: "보러 가기",
  },
  {
    id: "gratitude",
    icon: "📝",
    title: "감사일기 1편 쓰기",
    desc: "오늘 감사한 일을 한 줄 기록",
    cta: "쓰러 가기",
  },
  {
    id: "character",
    icon: "👤",
    title: "닮은 인물 찾기",
    desc: "성경 인물 매칭 1회 완료",
    cta: "도전하기",
  },
];

export const ACTIVE_COUNT = 3;

export interface MissionsState {
  date: string; // YYYY-MM-DD
  /** 오늘 활성화된 3개 미션 id. */
  active: MissionId[];
  /** mission id별 완료 여부 (today 기준). active에 없는 id 기록도 보존. */
  done: Partial<Record<MissionId, boolean>>;
  /** 오늘 토스 프로모션으로 포인트 수령 여부 */
  claimed?: boolean;
  /** 토스가 발급한 reward key */
  claimKey?: string;
}

function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 풀에서 ACTIVE_COUNT 개 랜덤 선택. exclude 배열은 우선 제외(부족하면 포함). */
export function pickRandomActive(exclude: MissionId[] = []): MissionId[] {
  const ids = MISSION_POOL.map((d) => d.id);
  const preferred = ids.filter((id) => !exclude.includes(id));
  // Fisher–Yates 셔플
  const shuffle = (arr: MissionId[]): MissionId[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const picked = shuffle(preferred).slice(0, ACTIVE_COUNT);
  if (picked.length < ACTIVE_COUNT) {
    // 풀 작아서 부족하면 exclude 풀에서 채움
    const extras = shuffle(ids.filter((id) => !picked.includes(id))).slice(
      0,
      ACTIVE_COUNT - picked.length,
    );
    picked.push(...extras);
  }
  return picked;
}

function fresh(): MissionsState {
  return { date: todayKey(), active: pickRandomActive(), done: {} };
}

function load(): MissionsState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<MissionsState> & {
      done?: Record<string, boolean>;
    };
    if (parsed.date !== todayKey()) return fresh();

    const done: Partial<Record<MissionId, boolean>> = {};
    if (parsed.done && typeof parsed.done === "object") {
      const validIds = new Set(MISSION_POOL.map((m) => m.id));
      for (const [k, v] of Object.entries(parsed.done)) {
        if (validIds.has(k as MissionId) && v === true) {
          done[k as MissionId] = true;
        }
      }
    }

    let active: MissionId[];
    if (
      Array.isArray(parsed.active) &&
      parsed.active.length === ACTIVE_COUNT &&
      parsed.active.every((id) =>
        MISSION_POOL.some((m) => m.id === (id as MissionId)),
      )
    ) {
      active = parsed.active as MissionId[];
    } else {
      // v1 데이터(active 없음) → 새로 뽑되, 이미 완료된 항목 우선 포함해서 사용자 경험 보존
      const completedIds = (Object.keys(done) as MissionId[]).filter(
        (id) => done[id],
      );
      active = pickRandomActive();
      // 완료된 항목이 있으면 active에 끼워넣기 (3개 유지)
      for (const id of completedIds) {
        if (!active.includes(id) && active.length < ACTIVE_COUNT) {
          active.unshift(id);
        }
      }
      active = active.slice(0, ACTIVE_COUNT);
    }

    return {
      date: parsed.date,
      active,
      done,
      claimed: parsed.claimed === true,
      claimKey: typeof parsed.claimKey === "string" ? parsed.claimKey : undefined,
    };
  } catch {
    return fresh();
  }
}

function save(s: MissionsState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function emitChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent("missions:changed"));
  } catch {
    /* ignore */
  }
}

export function getMissions(): MissionsState {
  return load();
}

/** 미션 정의 단일 조회. 풀에 없으면 null. */
export function getMissionDef(id: MissionId): MissionDef | null {
  return MISSION_POOL.find((m) => m.id === id) ?? null;
}

export function completeMission(id: MissionId): MissionsState {
  const s = load();
  if (s.done[id]) return s;
  s.done[id] = true;
  save(s);
  emitChanged();
  return s;
}

export function missionsDoneCount(s: MissionsState): number {
  return s.active.filter((id) => s.done[id]).length;
}

export function isAllMissionsDone(s: MissionsState = load()): boolean {
  return s.active.every((id) => s.done[id]);
}

export function isMissionRewardClaimedToday(): boolean {
  return load().claimed === true;
}

export function markMissionRewardClaimed(claimKey?: string): MissionsState {
  const s = load();
  s.claimed = true;
  if (claimKey) s.claimKey = claimKey;
  save(s);
  emitChanged();
  return s;
}

/**
 * 활성 미션 세트를 새로운 랜덤 3개로 교체.
 * 가능하면 현재 active와 다른 항목들로 우선 채움 (사용자가 새로움을 느끼도록).
 *
 * 리롤 시 완료 기록(`done`)도 비워서, 같은 id가 다시 등장하더라도 처음부터 다시 수행해야 한다.
 * (사용자가 "추가로 수행"을 눌렀을 때 기대하는 동작 — 새 세트는 새 도전.)
 */
export function rerollMissions(): MissionsState {
  const s = load();
  const next: MissionsState = {
    ...s,
    active: pickRandomActive(s.active),
    done: {},
  };
  save(next);
  emitChanged();
  return next;
}

/**
 * 미완료 미션 항목 클릭 시 발동되는 액션 이벤트.
 *  - verse: DailyVerse 펼치고 TTS 자동 재생
 *  - quiz: 퀴즈 탭으로 이동하고 '쉬움' 버튼에 두근두근 강조
 *  - prayer: 기도 탭으로 이동
 *  - gratitude: 기도 탭으로 이동 + 감사일기 작성 모달 자동 열기
 *  - character: 인물 탭으로 이동
 */
export function invokeMissionAction(id: MissionId): void {
  try {
    window.dispatchEvent(new CustomEvent("mission:invoke", { detail: { id } }));
  } catch {
    /* ignore */
  }
}
