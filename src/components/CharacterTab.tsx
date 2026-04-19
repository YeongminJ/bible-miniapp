import { useState, useEffect } from "react";
import VerseAudio from "./VerseAudio";

interface Character {
  id: number;
  name: string;
  nameEn: string;
  testament: string;
  era: string;
  title: string;
  summary: string;
  keyVirtue: string;
  keyVerse: string;
  keyVerseText: string;
  lessonForToday: string;
  books: string[];
}

const ERAS = ["전체", "구약", "신약"];

// 시대별 그라디언트 색상
const ERA_COLORS: Record<string, [string, string]> = {
  "창조시대": ["#1E3A5F", "#2E5984"],
  "족장시대": ["#5B3A1A", "#8B6914"],
  "출애굽시대": ["#7B2D26", "#C2452D"],
  "사사시대": ["#2D4A22", "#4A7A32"],
  "통일왕국": ["#4A2D6B", "#7B4FA2"],
  "분열왕국": ["#6B3A2D", "#A25B4F"],
  "포로시대": ["#1A2F3A", "#2D5060"],
  "귀환시대": ["#2D5A3A", "#4A8A5F"],
  "복음서시대": ["#0D4A6B", "#1A7AAA"],
  "초대교회시대": ["#3A1A5B", "#6B3AAA"],
};

// 덕목별 아이콘
const VIRTUE_ICONS: Record<string, string> = {
  "순종": "🕊️", "믿음": "✝️", "용기": "🛡️", "지혜": "📜", "인내": "⚓",
  "회개": "💧", "사랑": "❤️", "겸손": "🌿", "충성": "⭐", "헌신": "🔥",
  "기도": "🙏", "소명": "📢", "정의": "⚖️", "섬김": "🤲", "찬양": "🎵",
  "치유": "✨", "리더십": "👑", "선교": "🌍", "예언": "📖", "감사": "🌾",
};

function getVirtueIcon(virtue: string): string {
  return VIRTUE_ICONS[virtue] || "✦";
}

// 시대별 프롬프트 힌트
const ERA_PROMPTS: Record<string, string> = {
  "창조시대": "ancient garden paradise setting",
  "족장시대": "desert nomad tent camp setting",
  "출애굽시대": "ancient Egyptian and desert setting",
  "사사시대": "ancient Canaan battlefield setting",
  "통일왕국": "ancient royal palace Jerusalem setting",
  "분열왕국": "ancient divided kingdom temple setting",
  "포로시대": "ancient Babylon exile setting",
  "귀환시대": "rebuilt Jerusalem temple setting",
  "복음서시대": "ancient Galilee village setting",
  "초대교회시대": "ancient Roman empire Mediterranean setting",
};

const R2_BASE = "https://pub-7f6f4f93019b41ba9d9ade42f6e1cd25.r2.dev";

function getCharacterImageUrl(id: number): string {
  return `${R2_BASE}/characters/${id.toString().padStart(3, "0")}.jpg`;
}

export default function CharacterTab() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [filter, setFilter] = useState("전체");
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/characters.json`)
      .then((r) => r.json())
      .then(setCharacters);
  }, []);

  const filtered = filter === "전체"
    ? characters
    : characters.filter((c) => c.testament === filter);

  if (selectedChar) {
    return (
      <div style={styles.container}>
        <button style={styles.backButton} onClick={() => setSelectedChar(null)}>
          ← 목록으로
        </button>
        <div style={styles.detailCard}>
          {/* 히어로 배너 */}
          <div style={{
            ...styles.heroBanner,
            background: `linear-gradient(160deg, ${(ERA_COLORS[selectedChar.era] || ["#374151", "#6B7280"])[0]}, ${(ERA_COLORS[selectedChar.era] || ["#374151", "#6B7280"])[1]})`,
          }}>
            <img
              src={getCharacterImageUrl(selectedChar.id)}
              alt={selectedChar.name}
              style={styles.heroImage}
            />
          </div>
          <div style={styles.detailHeader}>
            <div>
              <div style={styles.detailName}>{selectedChar.name}</div>
              <div style={styles.detailNameEn}>{selectedChar.nameEn}</div>
            </div>
          </div>

          <div style={styles.detailTitle}>{selectedChar.title}</div>

          <div style={styles.tagRow}>
            <span style={styles.eraTag}>{selectedChar.era}</span>
            <span style={styles.virtueTag}>{selectedChar.keyVirtue}</span>
            <span style={styles.testamentTag}>{selectedChar.testament}</span>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>인물 소개</div>
            <div style={styles.sectionContent}>{selectedChar.summary}</div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#9CA3AF", marginBottom: "8px", letterSpacing: "1px" }}>핵심 말씀</div>
            <VerseAudio
              reference={selectedChar.keyVerse}
              verseText={selectedChar.keyVerseText}
            />
          </div>

          <div style={styles.lessonCard}>
            <div style={styles.lessonLabel}>💭 오늘의 묵상</div>
            <div style={styles.lessonText}>{selectedChar.lessonForToday}</div>
          </div>

          <div style={styles.booksRow}>
            {selectedChar.books.map((book) => (
              <span key={book} style={styles.bookTag}>{book}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 필터 */}
      <div style={styles.filterRow}>
        {ERAS.map((era) => (
          <button
            key={era}
            onClick={() => setFilter(era)}
            style={{
              ...styles.filterButton,
              backgroundColor: era === filter ? "#0D9488" : "#F3F4F6",
              color: era === filter ? "#FFFFFF" : "#6B7280",
            }}
          >
            {era}
          </button>
        ))}
        <span style={styles.countBadge}>{filtered.length}명</span>
      </div>

      {/* 인물 그리드 */}
      <div style={styles.grid}>
        {filtered.map((char) => {
          const colors = ERA_COLORS[char.era] || ["#374151", "#6B7280"];
          return (
            <button
              key={char.id}
              style={{
                ...styles.charCard,
                background: `linear-gradient(160deg, ${colors[0]}, ${colors[1]})`,
              }}
              onClick={() => setSelectedChar(char)}
            >
              <div style={styles.charImageWrap}>
                <img
                  src={getCharacterImageUrl(char.id)}
                  alt={char.name}
                  style={styles.charImage}
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <span style={styles.charVirtueIcon}>{getVirtueIcon(char.keyVirtue)}</span>
              </div>
              <div style={styles.charName}>{char.name}</div>
              <div style={styles.charTitle}>{char.title}</div>
              <div style={styles.charVirtue}>{char.keyVirtue}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: "16px" },
  filterRow: { display: "flex", gap: "8px", marginBottom: "16px", alignItems: "center" },
  filterButton: {
    padding: "8px 16px", borderRadius: "100px", fontSize: "13px",
    fontWeight: 700, border: "none", cursor: "pointer",
  },
  countBadge: {
    marginLeft: "auto", fontSize: "12px", color: "#9CA3AF", fontWeight: 600,
  },
  grid: {
    display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px",
  },
  charCard: {
    padding: "12px 8px 14px", borderRadius: "20px",
    border: "none", cursor: "pointer", textAlign: "center" as const,
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
    overflow: "hidden", position: "relative" as const,
  },
  charImageWrap: {
    width: "60px", height: "60px", borderRadius: "50%",
    overflow: "hidden", position: "relative" as const,
    border: "2px solid rgba(255,255,255,0.4)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  charImage: {
    width: "100%", height: "100%", objectFit: "cover" as const,
  },
  charVirtueIcon: {
    position: "absolute" as const, bottom: "-2px", right: "-2px",
    fontSize: "16px", zIndex: 2,
  },
  charName: { fontSize: "13px", fontWeight: 800, color: "#FFFFFF", textShadow: "0 1px 2px rgba(0,0,0,0.2)" },
  charTitle: { fontSize: "10px", color: "rgba(255,255,255,0.8)", lineHeight: "1.3" },
  charVirtue: {
    fontSize: "10px", fontWeight: 700, color: "#FFFFFF",
    backgroundColor: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: "100px",
  },
  // Detail
  backButton: {
    padding: "8px 16px", fontSize: "14px", fontWeight: 600,
    color: "#0D9488", backgroundColor: "transparent",
    border: "none", cursor: "pointer", marginBottom: "16px",
  },
  detailCard: {
    backgroundColor: "#FFFFFF", borderRadius: "24px",
    padding: "24px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  },
  heroBanner: {
    margin: "-24px -24px 0",
    padding: "32px 24px 24px",
    display: "flex", justifyContent: "center",
    borderRadius: "0 0 32px 32px",
  },
  heroImage: {
    width: "120px", height: "120px", borderRadius: "50%",
    objectFit: "cover" as const,
    border: "3px solid rgba(255,255,255,0.5)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
  },
  detailHeader: { display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px", marginTop: "16px", justifyContent: "center", textAlign: "center" as const, flexDirection: "column" },
  detailName: { fontSize: "24px", fontWeight: 900, color: "#111827" },
  detailNameEn: { fontSize: "14px", color: "#9CA3AF" },
  detailTitle: {
    fontSize: "18px", fontWeight: 700, color: "#374151",
    marginBottom: "16px", paddingBottom: "16px",
    borderBottom: "1px solid #F3F4F6",
  },
  tagRow: { display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" },
  eraTag: {
    padding: "4px 12px", borderRadius: "100px", fontSize: "12px",
    fontWeight: 700, backgroundColor: "#EDE9FE", color: "#6D28D9",
  },
  virtueTag: {
    padding: "4px 12px", borderRadius: "100px", fontSize: "12px",
    fontWeight: 700, backgroundColor: "#FEF3C7", color: "#92400E",
  },
  testamentTag: {
    padding: "4px 12px", borderRadius: "100px", fontSize: "12px",
    fontWeight: 700, backgroundColor: "#F0FDFA", color: "#0D9488",
  },
  section: { marginBottom: "20px" },
  sectionTitle: { fontSize: "13px", fontWeight: 700, color: "#9CA3AF", marginBottom: "8px", letterSpacing: "1px" },
  sectionContent: { fontSize: "15px", color: "#374151", lineHeight: "1.7" },
  verseCard: {
    padding: "20px", backgroundColor: "#F0FDFA", borderRadius: "16px",
    marginBottom: "16px", borderLeft: "4px solid #0D9488",
  },
  verseLabel: { fontSize: "12px", fontWeight: 700, color: "#0D9488", marginBottom: "8px" },
  verseText: { fontSize: "15px", color: "#115E59", fontStyle: "italic", lineHeight: "1.6", marginBottom: "8px" },
  verseRef: { fontSize: "12px", color: "#6B7280" },
  lessonCard: {
    padding: "20px", borderRadius: "16px", marginBottom: "16px",
    background: "linear-gradient(135deg, rgba(13,148,136,0.06), rgba(109,66,181,0.04))",
    border: "1px solid rgba(13,148,136,0.12)",
  },
  lessonLabel: { fontSize: "13px", fontWeight: 700, color: "#0D9488", marginBottom: "8px" },
  lessonText: { fontSize: "15px", color: "#1F2937", lineHeight: "1.6", fontWeight: 600 },
  booksRow: { display: "flex", gap: "6px", flexWrap: "wrap" },
  bookTag: {
    padding: "4px 10px", borderRadius: "8px", fontSize: "11px",
    fontWeight: 600, backgroundColor: "#F3F4F6", color: "#6B7280",
  },
};
