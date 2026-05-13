// 성경 통독 진행 상태 — 절(verse) 단위 추적.
//
// 정책:
//  - 한 절을 끝까지 들으면 즉시 기록 (절 완료).
//  - 한 장의 모든 절을 다 들으면 그 장이 완료된 것으로 간주.
//  - 사용자가 도중에 종료하면 그 장은 부분 완료(예: 20/31). 다음 진입 시 21절부터 이어듣기.
//
// 저장 모델: `verseProgress["bookId:chapter"] = lastHeardVerse`
//  - 값이 chapter의 verse_count 와 같으면 그 장이 완료.
//  - 값이 0이거나 키 없으면 그 장 미시작.
//  - 한 번 들으면 점점 커지기만 함 (감소 없음).

import type { BookMeta } from "./bible-data";

const KEY = "bibleReading.v2";
const AD_KEY = "bibleReadingAd.v1";

function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 오늘 이미 광고를 보여줬는지 (KST 날짜 기준). */
export function hasAdShownToday(): boolean {
  try {
    return localStorage.getItem(AD_KEY) === todayKey();
  } catch {
    return false;
  }
}

/** 오늘 광고 보여줬다고 마킹. */
export function markAdShownToday(): void {
  try {
    localStorage.setItem(AD_KEY, todayKey());
  } catch {
    /* ignore */
  }
}

export interface ReadingState {
  /** "bookId:chapter" → 가장 최근에 끝까지 들은 절 번호 (1-based). 미시작이면 키 없음. */
  verseProgress: Record<string, number>;
}

export const TOTAL_BIBLE_CHAPTERS = 1189; // 66권 합계

function fresh(): ReadingState {
  return { verseProgress: {} };
}

function load(): ReadingState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<ReadingState> | null;
    if (!parsed || typeof parsed.verseProgress !== "object") return fresh();
    const vp: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed.verseProgress || {})) {
      if (typeof v === "number" && v > 0) vp[k] = v;
    }
    return { verseProgress: vp };
  } catch {
    return fresh();
  }
}

function save(s: ReadingState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function emitChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent("bibleReading:changed"));
  } catch {
    /* ignore */
  }
}

function chapterKey(bookId: number, chapter: number): string {
  return `${bookId}:${chapter}`;
}

export function getReadingState(): ReadingState {
  return load();
}

export function getChapterLastVerse(
  bookId: number,
  chapter: number,
  s: ReadingState = load(),
): number {
  return s.verseProgress[chapterKey(bookId, chapter)] ?? 0;
}

/**
 * 절 N을 끝까지 들었음을 기록. 이미 더 큰 값이 있으면 noop.
 */
export function markVerseHeard(
  bookId: number,
  chapter: number,
  verse: number,
): ReadingState {
  const s = load();
  const key = chapterKey(bookId, chapter);
  const prev = s.verseProgress[key] ?? 0;
  if (verse <= prev) return s; // 이미 더 진행됐음 (역행 방지)
  s.verseProgress[key] = verse;
  save(s);
  emitChanged();
  return s;
}

export function isChapterCompleted(
  bookId: number,
  chapter: number,
  totalVerses: number,
  s: ReadingState = load(),
): boolean {
  const last = s.verseProgress[chapterKey(bookId, chapter)] ?? 0;
  return totalVerses > 0 && last >= totalVerses;
}

/**
 * 다음에 들어야 할 위치. 첫 미완 장의 (마지막 들은 절 + 1).
 *  - 어떤 장도 시작 안 했으면: 창세기 1장 1절
 *  - 부분 완료된 장이 있으면: 그 장의 다음 절
 *  - 모든 장 완료면 null
 */
export function getResumeTarget(
  index: BookMeta[],
  s: ReadingState = load(),
): { bookId: number; chapter: number; verse: number } | null {
  for (const book of index) {
    for (let ch = 1; ch <= book.chapter_count; ch++) {
      const total = book.verse_counts[ch - 1] ?? 0;
      if (total === 0) continue; // 빈 장 건너뜀
      const last = s.verseProgress[chapterKey(book.id, ch)] ?? 0;
      if (last < total) {
        return { bookId: book.id, chapter: ch, verse: last + 1 };
      }
    }
  }
  return null;
}

export interface BookProgress {
  bookId: number;
  done: number;
  total: number;
  percent: number; // 0~100 (정수)
}

/** 책별 완료된 장 개수 / 전체 장 수. */
export function getBookProgress(
  book: BookMeta,
  s: ReadingState = load(),
): BookProgress {
  let done = 0;
  for (let ch = 1; ch <= book.chapter_count; ch++) {
    const total = book.verse_counts[ch - 1] ?? 0;
    const last = s.verseProgress[chapterKey(book.id, ch)] ?? 0;
    if (total > 0 && last >= total) done++;
  }
  return {
    bookId: book.id,
    done,
    total: book.chapter_count,
    percent:
      book.chapter_count === 0 ? 0 : Math.round((done / book.chapter_count) * 100),
  };
}

export interface TotalProgress {
  done: number;
  total: number;
  percent: number; // 한 자리 소수
}

export function getTotalProgress(
  index: BookMeta[],
  s: ReadingState = load(),
): TotalProgress {
  let done = 0;
  for (const book of index) {
    for (let ch = 1; ch <= book.chapter_count; ch++) {
      const total = book.verse_counts[ch - 1] ?? 0;
      const last = s.verseProgress[chapterKey(book.id, ch)] ?? 0;
      if (total > 0 && last >= total) done++;
    }
  }
  return {
    done,
    total: TOTAL_BIBLE_CHAPTERS,
    percent: Math.round((done / TOTAL_BIBLE_CHAPTERS) * 1000) / 10,
  };
}

/** 현재 책+장 다음의 (책, 장)을 반환. 더 없으면 null. */
export function getNextChapter(
  index: BookMeta[],
  bookId: number,
  chapter: number,
): { bookId: number; chapter: number } | null {
  const book = index.find((b) => b.id === bookId);
  if (!book) return null;
  if (chapter < book.chapter_count) {
    return { bookId, chapter: chapter + 1 };
  }
  const next = index.find((b) => b.id === bookId + 1);
  if (next) return { bookId: next.id, chapter: 1 };
  return null;
}

export function isAllCompleted(
  index: BookMeta[],
  s: ReadingState = load(),
): boolean {
  return getTotalProgress(index, s).done >= TOTAL_BIBLE_CHAPTERS;
}
