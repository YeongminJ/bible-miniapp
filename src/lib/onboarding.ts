// 온보딩 1회 표시 플래그
const KEY = "onboarded.v1";
const AT_KEY = "onboardedAt.v1"; // 진단용 timestamp(ms). resetOnboarded 해도 보존.

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

export function markOnboarded() {
  try {
    localStorage.setItem(KEY, "true");
    // 최초 1회만 시간 기록 — recovery 빈도가 높아도 원래 onboarded 시점 유지.
    if (localStorage.getItem(AT_KEY) == null) {
      localStorage.setItem(AT_KEY, String(Date.now()));
    }
  } catch { /* ignore */ }
}

export function resetOnboarded() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** 최초 온보딩 시점(ms epoch). 없으면 null. */
export function getOnboardedAt(): number | null {
  try {
    const v = localStorage.getItem(AT_KEY);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
