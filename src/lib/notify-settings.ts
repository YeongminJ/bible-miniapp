// 오늘의 말씀 알림 옵트인/시간 설정 (기능성 메시지 검수 통과용)
const KEY = "notifySettings.v1";

export type NotifyTime = "08:00" | "10:00" | "12:00" | "15:00" | "18:00" | "20:00" | "22:00";

export const TIME_OPTIONS: NotifyTime[] = [
  "08:00", "10:00", "12:00", "15:00", "18:00", "20:00", "22:00",
];

export interface NotifySettings {
  enabled: boolean;
  times: NotifyTime[];
  optedInAt: number | null; // ms timestamp — 동의한 시점
}

const DEFAULT: NotifySettings = {
  enabled: false,
  times: ["10:00", "20:00"],
  optedInAt: null,
};

export function loadNotifySettings(): NotifySettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      times: Array.isArray(parsed.times) && parsed.times.length > 0 ? parsed.times : DEFAULT.times,
      optedInAt: typeof parsed.optedInAt === "number" ? parsed.optedInAt : null,
    };
  } catch {
    return DEFAULT;
  }
}

export function saveNotifySettings(s: NotifySettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent("notifySettings:changed"));
  } catch { /* ignore */ }
}
