// 성경 본문 데이터 fetch + 메모리 캐시.
// 정적 JSON 파일은 `public/data/bible/` 에 위치 (export-bible.py로 생성).
//   - index.json: 66권 메타
//   - {bookId}.json: 한 책 전체 (모든 장 + 절 + 요약)

const BASE = `${import.meta.env.BASE_URL}data/bible`;

export interface BookMeta {
  id: number;
  name_kr: string;
  name_en: string;
  testament: "OT" | "NT";
  chapter_count: number;
  /** chapter index(1-based)별 절 개수. verse_counts[c-1] === c장의 절 수. */
  verse_counts: number[];
}

export interface VerseRow {
  verse: number;
  text: string;
}

export interface ChapterData {
  chapter: number;
  verses: VerseRow[];
  summary?: string;
  question?: string;
}

export interface BookData extends BookMeta {
  chapters: ChapterData[];
}

let _indexCache: BookMeta[] | null = null;
const _bookCache = new Map<number, BookData>();
const _bookInflight = new Map<number, Promise<BookData>>();

export async function loadIndex(): Promise<BookMeta[]> {
  if (_indexCache) return _indexCache;
  try {
    const res = await fetch(`${BASE}/index.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _indexCache = (await res.json()) as BookMeta[];
    return _indexCache;
  } catch (err) {
    console.warn("[bible-data] loadIndex failed", err);
    return [];
  }
}

export async function loadBook(bookId: number): Promise<BookData | null> {
  const cached = _bookCache.get(bookId);
  if (cached) return cached;
  const inflight = _bookInflight.get(bookId);
  if (inflight) return inflight;

  const p = (async () => {
    const res = await fetch(`${BASE}/${bookId}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as BookData;
    _bookCache.set(bookId, data);
    return data;
  })();
  _bookInflight.set(bookId, p);
  try {
    return await p;
  } catch (err) {
    console.warn("[bible-data] loadBook failed", bookId, err);
    return null;
  } finally {
    _bookInflight.delete(bookId);
  }
}

/** 동기적으로 캐시된 책 가져오기 (없으면 null) — 렌더링 즉시성용 */
export function peekBookCache(bookId: number): BookData | null {
  return _bookCache.get(bookId) ?? null;
}

/** index에서 단건 메타 찾기 (loadIndex 이후 호출 가정). */
export function getBookMeta(
  index: BookMeta[],
  bookId: number,
): BookMeta | null {
  return index.find((b) => b.id === bookId) ?? null;
}
