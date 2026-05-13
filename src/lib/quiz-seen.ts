// 최근 출제된 퀴즈 id를 난이도별로 누적 저장.
// startQuiz 시 풀에서 seen을 우선 제외해서 같은 문제 반복 등장을 줄인다.
// 풀의 거의 전부를 다 보면 자동 리셋되어 다시 처음부터 순환.

const KEY = "quizSeen.v1";

export type Difficulty = "쉬움" | "보통" | "어려움" | "전체" | "무한";

type Store = Partial<Record<Difficulty, number[]>>;

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    // 검증: 각 항목이 number[] 인지
    const out: Store = {};
    for (const k of Object.keys(parsed) as Difficulty[]) {
      const arr = parsed[k];
      if (Array.isArray(arr)) {
        out[k] = arr.filter((v) => typeof v === "number");
      }
    }
    return out;
  } catch {
    return {};
  }
}

function save(s: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function getSeen(diff: Difficulty): Set<number> {
  const s = load();
  return new Set(s[diff] ?? []);
}

export function markSeen(diff: Difficulty, ids: number[]): void {
  if (ids.length === 0) return;
  const s = load();
  const cur = new Set(s[diff] ?? []);
  for (const id of ids) cur.add(id);
  s[diff] = Array.from(cur);
  save(s);
}

export function resetSeen(diff: Difficulty): void {
  const s = load();
  delete s[diff];
  save(s);
}

/**
 * 미세 셔플 — Fisher-Yates. 균일 분포.
 */
export function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * pool에서 size개 선택. seen에 들어있는 id는 우선 제외.
 * 남은 후보가 size보다 적으면 seen 자동 리셋 후 전체 풀에서 다시 선택.
 *
 * 반환된 id들을 호출 측에서 markSeen()으로 기록하면 됨.
 */
export function pickFreshQuizzes<T extends { id: number }>(
  pool: T[],
  diff: Difficulty,
  size: number,
): T[] {
  if (pool.length === 0) return [];
  const seen = getSeen(diff);
  let candidates = pool.filter((q) => !seen.has(q.id));
  // 새 후보가 부족하면 리셋하고 전체 풀에서 다시 뽑기 (한 사이클 완주 = 다음 사이클 시작)
  if (candidates.length < size) {
    resetSeen(diff);
    candidates = pool.slice();
  }
  const shuffled = fisherYatesShuffle(candidates);
  return shuffled.slice(0, Math.min(size, shuffled.length));
}
