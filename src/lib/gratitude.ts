// 감사일기 (Gratitude Journal) — 로컬스토리지 기반 비동기화 저장.
// 사용자가 기도 탭에서 플로팅 버튼으로 작성 → "아멘"으로 제출 → 히스토리에 누적.
// MVP는 단말 로컬에만 저장 (서버 sync 없음).

const KEY = "gratitudeJournal.v1";
const MAX_CONTENT_LENGTH = 1000;

export interface GratitudeEntry {
  /** epoch ms 기반 ID. 정렬과 충돌 방지에 유리. */
  id: string;
  /** 작성한 내용. 공백 trim 후 저장. */
  content: string;
  /** 작성 시각 epoch ms. */
  createdAt: number;
}

interface State {
  entries: GratitudeEntry[]; // newest first
}

function fresh(): State {
  return { entries: [] };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<State> | null;
    if (!parsed || !Array.isArray(parsed.entries)) return fresh();
    // 기본 sanitization — id/content/createdAt 필드 모두 있어야 함
    const entries = parsed.entries
      .filter(
        (e): e is GratitudeEntry =>
          typeof e?.id === "string" &&
          typeof e?.content === "string" &&
          typeof e?.createdAt === "number",
      )
      // 최신이 위에 오도록 정렬
      .sort((a, b) => b.createdAt - a.createdAt);
    return { entries };
  } catch {
    return fresh();
  }
}

function save(s: State): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function emitChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent("gratitude:changed"));
  } catch {
    /* ignore */
  }
}

export function getGratitudeEntries(): GratitudeEntry[] {
  return load().entries;
}

export function getGratitudeCount(): number {
  return load().entries.length;
}

/**
 * 새 감사일기 작성. 빈 내용은 무시(반환 null).
 * 동일 시점 여러 번 호출돼도 id가 ms 기반이라 사실상 충돌 없음 (동시 클릭 방어로 random suffix).
 */
export function addGratitudeEntry(content: string): GratitudeEntry | null {
  const trimmed = content.trim();
  if (!trimmed) return null;
  const limited =
    trimmed.length > MAX_CONTENT_LENGTH
      ? trimmed.slice(0, MAX_CONTENT_LENGTH)
      : trimmed;
  const now = Date.now();
  const entry: GratitudeEntry = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    content: limited,
    createdAt: now,
  };
  const s = load();
  s.entries = [entry, ...s.entries];
  save(s);
  emitChanged();
  return entry;
}

/** 일기 삭제. id 못 찾으면 noop. */
export function removeGratitudeEntry(id: string): void {
  const s = load();
  const next = s.entries.filter((e) => e.id !== id);
  if (next.length === s.entries.length) return;
  save({ entries: next });
  emitChanged();
}

export const GRATITUDE_MAX_LENGTH = MAX_CONTENT_LENGTH;
