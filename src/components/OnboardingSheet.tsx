import { useState } from "react";
import {
  TIME_OPTIONS,
  saveNotifySettings,
  loadNotifySettings,
  type NotifyTime,
} from "../lib/notify-settings";
import { markOnboarded } from "../lib/onboarding";
import { track } from "../lib/analytics";

interface Props {
  onDone: () => void;
}

export default function OnboardingSheet({ onDone }: Props) {
  const initial = loadNotifySettings();
  const [enabled, setEnabled] = useState<boolean>(initial.enabled);
  const [times, setTimes] = useState<NotifyTime[]>(
    initial.times.length > 0 ? initial.times : ["10:00", "20:00"]
  );

  const toggle = () => setEnabled((v) => !v);
  const toggleTime = (t: NotifyTime) => {
    setTimes((prev) => {
      const has = prev.includes(t);
      let next = has ? prev.filter((x) => x !== t) : [...prev, t];
      next = next.sort();
      if (next.length === 0) next = [t];
      return next;
    });
  };

  const finish = (action: "start" | "skip") => {
    const finalEnabled = action === "start" ? enabled : false;
    saveNotifySettings({
      enabled: finalEnabled,
      times,
      optedInAt: finalEnabled ? Date.now() : null,
    });
    markOnboarded();
    track.click("onboarding_complete", {
      action,
      notify_enabled: finalEnabled,
      times: times.join(","),
    });
    onDone();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.hero}>
          <div style={styles.heroEmoji}>📖</div>
          <h1 style={styles.title}>오늘의 말씀</h1>
          <p style={styles.subtitle}>매일 한 절의 말씀과 기도, 짧은 묵상</p>
        </div>

        <button
          style={{ ...styles.toggleRow, ...(enabled ? styles.toggleRowOn : {}) }}
          onClick={toggle}
        >
          <span style={styles.toggleEmoji}>🔔</span>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={styles.toggleTitle}>오늘의 말씀 알림 받기</div>
            <div style={styles.toggleDesc}>
              내가 정한 시각에 한 구절을 알려드려요.
            </div>
          </div>
          <div style={{ ...styles.switch, ...(enabled ? styles.switchOn : {}) }}>
            <div style={{ ...styles.switchKnob, ...(enabled ? styles.switchKnobOn : {}) }} />
          </div>
        </button>

        <div style={styles.timeSection}>
          <div style={styles.timeLabel}>알림 시각</div>
          <div style={styles.timeRow}>
            {TIME_OPTIONS.map((t) => {
              const on = times.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTime(t)}
                  disabled={!enabled}
                  style={{
                    ...styles.timeChip,
                    ...(on ? styles.timeChipOn : {}),
                    opacity: enabled ? 1 : 0.45,
                    cursor: enabled ? "pointer" : "not-allowed",
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <div style={styles.timeNote}>
            언제든 헤더의 🔔 버튼에서 다시 변경할 수 있어요.
          </div>
        </div>

        <div style={styles.actions}>
          <button style={styles.skipBtn} onClick={() => finish("skip")}>
            지금은 건너뛰기
          </button>
          <button style={styles.startBtn} onClick={() => finish("start")}>
            시작하기
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 1500,
    backgroundColor: "#FFFFFF",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "calc(env(safe-area-inset-top, 0px) + 16px) 16px calc(env(safe-area-inset-bottom, 0px) + 16px)",
    overflowY: "auto",
  },
  card: {
    width: "100%", maxWidth: "440px",
    display: "flex", flexDirection: "column" as const, gap: "20px",
  },
  hero: {
    textAlign: "center" as const,
    padding: "16px 0 8px",
  },
  heroEmoji: { fontSize: "56px", marginBottom: "12px" },
  title: {
    fontSize: "26px", fontWeight: 900, color: "#111827",
    letterSpacing: "-0.8px", margin: "0 0 6px",
  },
  subtitle: { fontSize: "14px", color: "#6B7280", margin: 0, lineHeight: 1.5 },

  toggleRow: {
    display: "flex", alignItems: "center", gap: "12px",
    width: "100%", padding: "16px",
    backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB",
    borderRadius: "16px", cursor: "pointer",
  },
  toggleRowOn: {
    backgroundColor: "#F0FDFA", border: "1px solid #A7F3D0",
  },
  toggleEmoji: { fontSize: "22px" },
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

  timeSection: {
    backgroundColor: "#F9FAFB",
    borderRadius: "16px",
    padding: "14px 16px",
  },
  timeLabel: {
    fontSize: "12px", fontWeight: 800, color: "#0D9488",
    letterSpacing: "0.3px", marginBottom: "10px",
  },
  timeRow: {
    display: "flex", flexWrap: "wrap" as const, gap: "8px",
    marginBottom: "10px",
  },
  timeChip: {
    padding: "8px 14px", borderRadius: "100px",
    backgroundColor: "#FFFFFF", color: "#374151",
    border: "1px solid #E5E7EB",
    fontSize: "13px", fontWeight: 700,
    transition: "all 0.15s",
  },
  timeChipOn: {
    backgroundColor: "#0D9488", color: "#FFFFFF",
    border: "1px solid #0D9488",
  },
  timeNote: { fontSize: "11px", color: "#9CA3AF", lineHeight: 1.5 },

  actions: {
    display: "flex", gap: "8px", marginTop: "8px",
  },
  skipBtn: {
    padding: "14px 18px", borderRadius: "12px",
    backgroundColor: "#F3F4F6", color: "#6B7280",
    fontSize: "14px", fontWeight: 700, border: "none", cursor: "pointer",
  },
  startBtn: {
    flex: 1, padding: "14px", borderRadius: "12px",
    backgroundColor: "#0D9488", color: "#FFFFFF",
    fontSize: "15px", fontWeight: 800, border: "none", cursor: "pointer",
  },
};
