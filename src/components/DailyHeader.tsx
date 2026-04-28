import { useEffect, useState } from "react";
import { tickStreak, type StreakState } from "../lib/streak";
import { getMissions, missionsDoneCount, type MissionsState } from "../lib/missions";

export default function DailyHeader() {
  const [streak, setStreak] = useState<StreakState>(() => ({ count: 0, lastDate: "", longest: 0 }));
  const [missions, setMissions] = useState<MissionsState>(() => getMissions());

  useEffect(() => {
    setStreak(tickStreak());
    const refresh = () => setMissions(getMissions());
    refresh();
    window.addEventListener("missions:changed", refresh);
    return () => window.removeEventListener("missions:changed", refresh);
  }, []);

  const done = missionsDoneCount(missions);
  const total = 3;
  const allDone = done === total;

  const missionItems: Array<{ id: keyof MissionsState["done"]; icon: string; label: string }> = [
    { id: "verse", icon: "📖", label: "말씀" },
    { id: "quiz", icon: "🎯", label: "퀴즈" },
    { id: "prayer", icon: "🙏", label: "기도" },
  ];

  return (
    <div style={styles.row}>
      <div style={{ ...styles.streakChip, ...(streak.count >= 7 ? styles.streakChipHot : {}) }}>
        <span style={styles.streakIcon}>🔥</span>
        <span style={styles.streakNum}>{streak.count}</span>
        <span style={styles.streakUnit}>일 연속</span>
      </div>
      <div style={{ ...styles.missionChip, ...(allDone ? styles.missionChipDone : {}) }}>
        {missionItems.map((m) => {
          const ok = missions.done[m.id];
          return (
            <span
              key={m.id}
              style={{
                ...styles.missionDot,
                opacity: ok ? 1 : 0.35,
                filter: ok ? "none" : "grayscale(0.7)",
              }}
              title={`${m.label} ${ok ? "완료" : "남음"}`}
              aria-label={`${m.label} ${ok ? "완료" : "남음"}`}
            >
              {m.icon}
            </span>
          );
        })}
        <span style={styles.missionCount}>{done}/{total}</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "flex", alignItems: "center", gap: "8px",
    padding: "8px 16px 0",
  },
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
  missionChip: {
    marginLeft: "auto",
    display: "flex", alignItems: "center", gap: "6px",
    padding: "5px 10px", borderRadius: "100px",
    backgroundColor: "#F3F4F6", color: "#374151",
    border: "1px solid #E5E7EB",
    fontSize: "12px", fontWeight: 800, lineHeight: 1,
  },
  missionChipDone: {
    backgroundColor: "#ECFDF5", color: "#065F46",
    border: "1px solid #A7F3D0",
  },
  missionDot: { fontSize: "13px", lineHeight: 1, transition: "opacity 0.2s" },
  missionCount: { fontSize: "11px", fontWeight: 800, marginLeft: "2px" },
};
