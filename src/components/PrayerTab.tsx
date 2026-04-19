import { useState, useEffect, useMemo } from "react";
import VerseAudio from "./VerseAudio";
import ReadAlongMode from "./ReadAlongMode";

interface Prayer {
  id: number;
  category: string;
  title: string;
  content: string;
  relatedVerse: string;
  relatedVerseText: string;
}

const CATEGORIES = ["전체", "감사", "치유", "인도", "가정", "직장", "시험", "회개", "평안", "아침", "저녁"];

// localStorage에서 읽은 기도 ID 관리
function getReadPrayers(): Set<number> {
  try {
    const saved = localStorage.getItem("readPrayers");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadPrayer(id: number) {
  const read = getReadPrayers();
  read.add(id);
  localStorage.setItem("readPrayers", JSON.stringify([...read]));
}

export default function PrayerTab() {
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [readAlongPrayer, setReadAlongPrayer] = useState<Prayer | null>(null);
  const [readIds, setReadIds] = useState<Set<number>>(getReadPrayers());

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/prayers.json`)
      .then((r) => r.json())
      .then(setPrayers);
  }, []);

  // 카테고리 변경 시 랜덤 셔플
  const filtered = useMemo(() => {
    const list = selectedCategory === "전체"
      ? prayers
      : prayers.filter((p) => p.category === selectedCategory);
    // 셔플
    return [...list].sort(() => Math.random() - 0.5);
  }, [prayers, selectedCategory]);

  const handleReadComplete = (prayerId: number) => {
    saveReadPrayer(prayerId);
    setReadIds(getReadPrayers());
    setReadAlongPrayer(null);
  };

  if (readAlongPrayer) {
    return (
      <ReadAlongMode
        title={readAlongPrayer.title}
        content={readAlongPrayer.content}
        onClose={() => handleReadComplete(readAlongPrayer.id)}
      />
    );
  }

  const readCount = filtered.filter((p) => readIds.has(p.id)).length;

  return (
    <div style={styles.container}>
      {/* 카테고리 칩 */}
      <div style={styles.chips}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              ...styles.chip,
              backgroundColor: cat === selectedCategory ? "#0D9488" : "#F3F4F6",
              color: cat === selectedCategory ? "#FFFFFF" : "#6B7280",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 읽기 현황 */}
      {readCount > 0 && (
        <div style={styles.statsBar}>
          <span>🙏 {readCount}개 기도 완료</span>
        </div>
      )}

      {/* 기도문 목록 */}
      <div style={styles.list}>
        {filtered.map((prayer) => {
          const isExpanded = expandedId === prayer.id;
          const isRead = readIds.has(prayer.id);
          return (
            <div key={prayer.id} style={{
              ...styles.card,
              borderLeft: isRead ? "4px solid #0D9488" : "4px solid transparent",
            }}>
              <button
                style={styles.cardHeader}
                onClick={() => setExpandedId(isExpanded ? null : prayer.id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={styles.categoryRow}>
                    <span style={styles.prayerCategory}>{prayer.category}</span>
                    {isRead && <span style={styles.amenBadge}>🕊️ 아멘</span>}
                  </div>
                  <div style={styles.prayerTitle}>{prayer.title}</div>
                </div>
                <span style={{ fontSize: "20px", color: "#9CA3AF", transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>
                  ▾
                </span>
              </button>

              {isExpanded && (
                <div style={styles.cardBody}>
                  <div style={styles.prayerContent}>{prayer.content}</div>
                  <VerseAudio
                    reference={prayer.relatedVerse}
                    verseText={prayer.relatedVerseText}
                  />
                  <button
                    style={styles.readAlongButton}
                    onClick={() => setReadAlongPrayer(prayer)}
                  >
                    🎙️ 따라 읽기
                  </button>
                  {!isRead && (
                    <button
                      style={styles.amenButton}
                      onClick={() => handleReadComplete(prayer.id)}
                    >
                      🕊️ 읽음 표시 (아멘)
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: "16px" },
  chips: {
    display: "flex", gap: "8px", overflowX: "auto",
    paddingBottom: "16px", flexWrap: "nowrap",
  },
  chip: {
    padding: "8px 16px", borderRadius: "100px", fontSize: "13px",
    fontWeight: 700, border: "none", cursor: "pointer",
    whiteSpace: "nowrap", flexShrink: 0,
  },
  statsBar: {
    padding: "10px 16px", backgroundColor: "#F0FDFA",
    borderRadius: "12px", marginBottom: "16px",
    fontSize: "13px", fontWeight: 700, color: "#0D9488",
    textAlign: "center" as const,
  },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  card: {
    backgroundColor: "#FFFFFF", borderRadius: "16px",
    overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    transition: "border-left 0.3s",
  },
  cardHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "16px 20px", width: "100%", border: "none",
    backgroundColor: "transparent", cursor: "pointer", textAlign: "left" as const,
  },
  categoryRow: {
    display: "flex", alignItems: "center", gap: "8px",
  },
  prayerCategory: {
    fontSize: "11px", fontWeight: 700, color: "#0D9488",
    textTransform: "uppercase" as const, letterSpacing: "1px",
  },
  amenBadge: {
    fontSize: "11px", fontWeight: 700, color: "#059669",
    backgroundColor: "#DCFCE7", padding: "2px 8px",
    borderRadius: "100px",
  },
  prayerTitle: {
    fontSize: "16px", fontWeight: 700, color: "#111827", marginTop: "4px",
  },
  cardBody: { padding: "0 20px 20px" },
  prayerContent: {
    fontSize: "15px", color: "#374151", lineHeight: "1.8",
    whiteSpace: "pre-wrap" as const, marginBottom: "16px",
  },
  readAlongButton: {
    width: "100%", padding: "14px", borderRadius: "12px",
    backgroundColor: "#0D9488", color: "#FFFFFF",
    fontSize: "15px", fontWeight: 700, border: "none",
    cursor: "pointer", marginTop: "12px",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
  },
  amenButton: {
    width: "100%", padding: "14px", borderRadius: "12px",
    backgroundColor: "#F0FDFA", color: "#0D9488",
    fontSize: "15px", fontWeight: 700,
    border: "2px solid #0D9488",
    cursor: "pointer", marginTop: "8px",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
  },
};
