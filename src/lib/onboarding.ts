// 온보딩 1회 표시 플래그
const KEY = "onboarded.v1";

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

export function markOnboarded() {
  try { localStorage.setItem(KEY, "true"); } catch { /* ignore */ }
}

export function resetOnboarded() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
