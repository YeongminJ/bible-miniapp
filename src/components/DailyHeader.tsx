import { useEffect, useRef, useState } from "react";
import { tickStreak, type StreakState } from "../lib/streak";
import { getMissions, missionsDoneCount, type MissionsState, type MissionId } from "../lib/missions";
import { loadNotifySettings, type NotifySettings } from "../lib/notify-settings";
import { track } from "../lib/analytics";
import NotifySettingsModal from "./NotifySettingsModal";

const MISSION_DEFS: Array<{ id: MissionId; icon: string; title: string; desc: string }> = [
  { id: "verse", icon: "📖", title: "오늘의 말씀 듣기", desc: "상단 오늘의 말씀에서 ▶ 재생" },
  { id: "quiz", icon: "🎯", title: "퀴즈 1문제 맞히기", desc: "퀴즈 탭에서 정답 1개 이상" },
  { id: "prayer", icon: "🙏", title: "기도 1편 아멘하기", desc: "기도 탭에서 따라읽기 또는 읽음 표시" },
];

export default function DailyHeader() {
  const [streak, setStreak] = useState<StreakState>(() => ({ count: 0, lastDate: "", longest: 0 }));
  const [missions, setMissions] = useState<MissionsState>(() => getMissions());
  const [notify, setNotify] = useState<NotifySettings>(() => loadNotifySettings());
  const [open, setOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setStreak(tickStreak());
    const refresh = () => setMissions(getMissions());
    refresh();
    window.addEventListener("missions:changed", refresh);
    const refreshNotify = () => setNotify(loadNotifySettings());
    window.addEventListener("notifySettings:changed", refreshNotify);
    return () => {
      window.removeEventListener("missions:changed", refresh);
      window.removeEventListener("notifySettings:changed", refreshNotify);
    };
  }, []);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && e.target instanceof Node && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const done = missionsDoneCount(missions);
  const total = MISSION_DEFS.length;
  const allDone = done === total;

  return (
    <div ref={wrapRef} style={styles.wrap}>
      <div style={styles.row}>
        <div style={{ ...styles.streakChip, ...(streak.count >= 7 ? styles.streakChipHot : {}) }}>
          <span style={styles.streakIcon}>🔥</span>
          <span style={styles.streakNum}>{streak.count}</span>
          <span style={styles.streakUnit}>일 연속</span>
        </div>
        <button
          style={{ ...styles.notifyBtn, ...(notify.enabled ? styles.notifyBtnOn : {}) }}
          onClick={() => {
            setNotifyOpen(true);
            track.click("notify_settings_open", { enabled: notify.enabled });
          }}
          aria-label="알림 설정"
        >
          🔔
          {notify.enabled && <span style={styles.notifyDot} />}
        </button>
        <button
          style={{ ...styles.missionBtn, ...(allDone ? styles.missionBtnDone : {}) }}
          onClick={() => {
            const next = !open;
            setOpen(next);
            track.click("daily_missions_toggle", { expanded: next });
          }}
          aria-expanded={open}
          aria-label={`오늘의 미션 ${done}/${total} 완료`}
        >
          <span style={styles.missionLabel}>오늘의 미션</span>
          <span style={styles.missionCount}>{done}/{total}</span>
          <span style={styles.missionCaret}>{open ? "▴" : "▾"}</span>
        </button>
      </div>

      <NotifySettingsModal open={notifyOpen} onClose={() => setNotifyOpen(false)} />
      {open && (
        <div style={styles.panel}>
          {MISSION_DEFS.map((m) => {
            const ok = missions.done[m.id];
            return (
              <div key={m.id} style={styles.item}>
                <span style={styles.itemIcon}>{m.icon}</span>
                <div style={styles.itemBody}>
                  <div style={styles.itemTitle}>{m.title}</div>
                  <div style={styles.itemDesc}>{m.desc}</div>
                </div>
                <span style={{ ...styles.itemStatus, ...(ok ? styles.itemStatusDone : {}) }}>
                  {ok ? "✓ 완료" : "남음"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { padding: "8px 16px 0", position: "relative" as const },
  row: { display: "flex", alignItems: "center", gap: "8px" },
  streakChip: {
    display: "flex", alignItems: "center", gap: "4px",
    padding: "5px 10px", borderRadius: "100px",
    backgroundColor: "#FFFBEB", color: "#92400E",
    border: "1px solid #FDE68A",
    fontSize: "12px", fontWeight: 800, lineHeight: 1,
  },
  streakChipHot: {
    backgroundColor: "#FEF2F2", color: "#9F1239",
    border: "1px solid #FECACA",
  },
  streakIcon: { fontSize: "13px" },
  streakNum: { fontSize: "13px", fontWeight: 900 },
  streakUnit: { fontSize: "11px", fontWeight: 700, opacity: 0.85 },
  notifyBtn: {
    marginLeft: "auto",
    width: "32px", height: "26px",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    padding: 0, borderRadius: "100px",
    backgroundColor: "#F3F4F6", color: "#374151",
    border: "1px solid #E5E7EB", cursor: "pointer",
    fontSize: "14px", lineHeight: 1, position: "relative" as const,
  },
  notifyBtnOn: {
    backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0",
  },
  notifyDot: {
    position: "absolute" as const, top: "-2px", right: "-2px",
    width: "8px", height: "8px", borderRadius: "50%",
    backgroundColor: "#10B981", border: "2px solid #FFFFFF",
  },
  missionBtn: {
    display: "flex", alignItems: "center", gap: "6px",
    padding: "5px 10px", borderRadius: "100px",
    backgroundColor: "#F3F4F6", color: "#374151",
    border: "1px solid #E5E7EB", cursor: "pointer",
    fontSize: "12px", fontWeight: 800, lineHeight: 1,
  },
  missionBtnDone: {
    backgroundColor: "#ECFDF5", color: "#065F46",
    border: "1px solid #A7F3D0",
  },
  missionLabel: { fontSize: "12px", fontWeight: 800 },
  missionCount: {
    fontSize: "11px", fontWeight: 900,
    backgroundColor: "rgba(255,255,255,0.7)",
    padding: "2px 6px", borderRadius: "100px",
  },
  missionCaret: { fontSize: "10px", marginLeft: "-2px" },
  panel: {
    marginTop: "6px",
    backgroundColor: "#FFFFFF",
    borderRadius: "14px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
    border: "1px solid #E5E7EB",
    padding: "8px",
    display: "flex", flexDirection: "column" as const, gap: "2px",
  },
  item: {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "10px 12px", borderRadius: "10px",
  },
  itemIcon: { fontSize: "20px", lineHeight: 1, flexShrink: 0 },
  itemBody: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: "14px", fontWeight: 800, color: "#111827", marginBottom: "2px" },
  itemDesc: { fontSize: "12px", color: "#6B7280", lineHeight: 1.4 },
  itemStatus: {
    fontSize: "11px", fontWeight: 800, color: "#9CA3AF",
    backgroundColor: "#F3F4F6",
    padding: "4px 10px", borderRadius: "100px",
    flexShrink: 0,
  },
  itemStatusDone: {
    color: "#065F46",
    backgroundColor: "#ECFDF5",
  },
};
