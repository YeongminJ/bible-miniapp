import { useEffect, useState } from "react";
import {
  loadNotifySettings,
  saveNotifySettings,
  TIME_OPTIONS,
  type NotifySettings,
  type NotifyTime,
} from "../lib/notify-settings";
import { track } from "../lib/analytics";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function NotifySettingsModal({ open, onClose }: Props) {
  const [s, setS] = useState<NotifySettings>(() => loadNotifySettings());

  useEffect(() => {
    if (open) setS(loadNotifySettings());
  }, [open]);

  if (!open) return null;

  const persist = (next: NotifySettings) => {
    setS(next);
    saveNotifySettings(next);
  };

  const toggleEnabled = () => {
    const enabling = !s.enabled;
    const next: NotifySettings = {
      ...s,
      enabled: enabling,
      optedInAt: enabling ? Date.now() : s.optedInAt,
    };
    persist(next);
    track.click("notify_settings_toggle", { enabled: enabling, times: s.times.join(",") });
  };

  const toggleTime = (t: NotifyTime) => {
    const has = s.times.includes(t);
    let times = has ? s.times.filter((x) => x !== t) : [...s.times, t];
    times = times.sort();
    if (times.length === 0) times = [t]; // 최소 하나는 유지
    persist({ ...s, times });
    track.click("notify_settings_time_change", { time: t, enabled: !has, count: times.length });
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.handle} />

        <div style={styles.header}>
          <h2 style={styles.title}>🔔 알림 설정</h2>
          <button style={styles.closeBtn} onClick={onClose} aria-label="닫기">×</button>
        </div>

        <div style={styles.body}>
          {/* 옵트인 토글 */}
          <button
            style={{ ...styles.toggleRow, ...(s.enabled ? styles.toggleRowOn : {}) }}
            onClick={toggleEnabled}
          >
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={styles.toggleTitle}>오늘의 말씀 알림 받기</div>
              <div style={styles.toggleDesc}>
                내가 정한 시각에 오늘의 성경 한 구절을 알려드려요.
              </div>
            </div>
            <div style={{ ...styles.switch, ...(s.enabled ? styles.switchOn : {}) }}>
              <div style={{ ...styles.switchKnob, ...(s.enabled ? styles.switchKnobOn : {}) }} />
            </div>
          </button>

          {/* 시간 선택 */}
          <div style={styles.section}>
            <div style={styles.sectionLabel}>알림 받을 시각 (다중 선택)</div>
            <div style={styles.timeRow}>
              {TIME_OPTIONS.map((t) => {
                const on = s.times.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTime(t)}
                    disabled={!s.enabled}
                    style={{
                      ...styles.timeChip,
                      ...(on ? styles.timeChipOn : {}),
                      opacity: s.enabled ? 1 : 0.45,
                      cursor: s.enabled ? "pointer" : "not-allowed",
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 안내 */}
          <div style={styles.notice}>
            <div style={styles.noticeRow}>
              <span style={styles.noticeIcon}>📨</span>
              <span>
                알림은 위 시각에 오늘의 성경 한 구절이 도착했음을 알려드리는 용도예요.
                광고/혜택 안내는 포함되지 않아요.
              </span>
            </div>
            <div style={styles.noticeRow}>
              <span style={styles.noticeIcon}>🛑</span>
              <span>
                해제는 이 화면에서 토글을 다시 끄면 즉시 적용돼요.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 1000,
    backgroundColor: "rgba(0,0,0,0.4)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
  },
  sheet: {
    width: "100%", maxWidth: "520px",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: "20px", borderTopRightRadius: "20px",
    paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
    maxHeight: "92vh", overflowY: "auto",
  },
  handle: {
    width: "44px", height: "5px", borderRadius: "100px",
    backgroundColor: "#E5E7EB", margin: "10px auto 6px",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "8px 20px 4px",
  },
  title: { fontSize: "18px", fontWeight: 900, color: "#111827", margin: 0 },
  closeBtn: {
    width: "32px", height: "32px", borderRadius: "50%",
    backgroundColor: "#F3F4F6", color: "#6B7280",
    border: "none", cursor: "pointer", fontSize: "20px", lineHeight: 1,
  },
  body: { padding: "8px 20px 16px" },
  toggleRow: {
    display: "flex", alignItems: "center", gap: "12px",
    width: "100%", padding: "16px",
    backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB",
    borderRadius: "16px", cursor: "pointer",
    marginBottom: "16px",
  },
  toggleRowOn: {
    backgroundColor: "#F0FDFA", border: "1px solid #A7F3D0",
  },
  toggleTitle: { fontSize: "15px", fontWeight: 800, color: "#111827", marginBottom: "4px" },
  toggleDesc: { fontSize: "12px", color: "#6B7280", lineHeight: 1.5 },
  switch: {
    width: "48px", height: "28px", borderRadius: "100px",
    backgroundColor: "#E5E7EB", position: "relative" as const,
    transition: "background-color 0.2s",
    flexShrink: 0,
  },
  switchOn: { backgroundColor: "#0D9488" },
  switchKnob: {
    width: "22px", height: "22px", borderRadius: "50%",
    backgroundColor: "#FFFFFF",
    position: "absolute" as const, top: "3px", left: "3px",
    transition: "transform 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  },
  switchKnobOn: { transform: "translateX(20px)" },
  section: { marginBottom: "16px" },
  sectionLabel: {
    fontSize: "12px", fontWeight: 800, color: "#0D9488",
    letterSpacing: "0.3px", marginBottom: "8px",
  },
  timeRow: {
    display: "flex", flexWrap: "wrap" as const, gap: "8px",
  },
  timeChip: {
    padding: "8px 14px", borderRadius: "100px",
    backgroundColor: "#F3F4F6", color: "#374151",
    border: "1px solid transparent",
    fontSize: "13px", fontWeight: 700,
    transition: "all 0.15s",
  },
  timeChipOn: {
    backgroundColor: "#0D9488", color: "#FFFFFF",
    border: "1px solid #0D9488",
  },
  notice: {
    backgroundColor: "#F9FAFB",
    borderRadius: "12px", padding: "12px 14px",
    display: "flex", flexDirection: "column" as const, gap: "8px",
  },
  noticeRow: {
    display: "flex", gap: "8px", alignItems: "flex-start",
    fontSize: "12px", color: "#4B5563", lineHeight: 1.55,
  },
  noticeIcon: { flexShrink: 0, fontSize: "13px" },
};
