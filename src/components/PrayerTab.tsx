import { useState, useEffect, useMemo } from "react";
import VerseAudio from "./VerseAudio";
import ReadAlongMode from "./ReadAlongMode";
import ProfileSelector from "./ProfileSelector";
import { loadProfile, matchScore, type UserProfile } from "../lib/profile";
import { useUser } from "../lib/UserContext";
import { saveUserData } from "../lib/userStore";

interface Prayer {
  id: number;
  category: string;
  title: string;
  content: string;
  relatedVerse: string;
  relatedVerseText: string;
  tags?: string[];
}

const CATEGORIES = ["맞춤", "전체", "감사", "치유", "인도", "가정", "직장", "시험", "회개", "평안", "아침", "저녁"];

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
  const [profile, setProfile] = useState<UserProfile | null>(loadProfile());
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(() =>
    loadProfile() ? "맞춤" : "전체"
  );
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [readAlongPrayer, setReadAlongPrayer] = useState<Prayer | null>(null);
  const { data: userData, update: updateUser } = useUser();
  const [readIds, setReadIds] = useState<Set<number>>(() => {
    const local = getReadPrayers();
    if (userData?.readPrayers?.length) {
      userData.readPrayers.forEach((id) => local.add(id));
    }
    return local;
  });
  const [showReadOnly, setShowReadOnly] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/prayers.json`)
      .then((r) => r.json())
      .then(setPrayers);
  }, []);

  // 카테고리별 필터링 + 프로필 매칭 정렬
  const filtered = useMemo(() => {
    if (prayers.length === 0) return [];

    let list: Prayer[];
    if (selectedCategory === "맞춤") {
      if (!profile) {
        list = [...prayers].sort(() => Math.random() - 0.5).slice(0, 40);
      } else {
        list = prayers
          .map((p) => ({ p, s: matchScore(p.tags, profile) }))
          .filter(({ s }) => s > 0)
          .sort((a, b) => b.s - a.s || Math.random() - 0.5)
          .map(({ p }) => p);
      }
    } else if (selectedCategory === "전체") {
      list = [...prayers].sort(() => Math.random() - 0.5);
    } else {
      const byCategory = prayers.filter((p) => p.category === selectedCategory);
      list = profile
        ? byCategory
            .map((p) => ({ p, s: matchScore(p.tags, profile) }))
            .sort((a, b) => b.s - a.s || Math.random() - 0.5)
            .map(({ p }) => p)
        : [...byCategory].sort(() => Math.random() - 0.5);
    }

    if (showReadOnly) {
      list = list.filter((p) => readIds.has(p.id));
    }
    return list;
  }, [prayers, selectedCategory, profile, showReadOnly, readIds]);

  const handleReadComplete = (prayerId: number) => {
    saveReadPrayer(prayerId);
    const updated = getReadPrayers();
    setReadIds(updated);
    saveUserData({ readPrayers: [...updated] });
    setReadAlongPrayer(null);
  };

  // 프로필 에디터 표시
  if (showProfileEditor) {
    return (
      <ProfileSelector
        initial={profile}
        title={profile ? "맞춤 설정 수정" : "맞춤 기도 설정"}
        onDone={(p) => {
          setProfile(p);
          setShowProfileEditor(false);
          setSelectedCategory("맞춤");
        }}
        onSkip={() => setShowProfileEditor(false)}
      />
    );
  }

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
      {/* 프로필 배너 */}
      {!profile ? (
        <button
          style={styles.profileBanner}
          onClick={() => setShowProfileEditor(true)}
        >
          <span>✨ 나에게 맞는 기도를 보려면 프로필을 설정해주세요</span>
          <span style={styles.bannerArrow}>›</span>
        </button>
      ) : (
        <button
          style={styles.profileInfo}
          onClick={() => setShowProfileEditor(true)}
        >
          <span style={styles.profileBadge}>
            {profile.ageGroup} · {profile.lifeStage} · {profile.family}
          </span>
          <span style={styles.profileEdit}>수정</span>
        </button>
      )}

      {/* 카테고리 칩 */}
      <div style={styles.chips}>
        {CATEGORIES.map((cat) => {
          const disabled = cat === "맞춤" && !profile;
          return (
            <button
              key={cat}
              onClick={() => {
                if (disabled) {
                  setShowProfileEditor(true);
                  return;
                }
                setSelectedCategory(cat);
              }}
              style={{
                ...styles.chip,
                backgroundColor: cat === selectedCategory ? "#0D9488" : "#F3F4F6",
                color: cat === selectedCategory ? "#FFFFFF" : "#6B7280",
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {cat === "맞춤" ? "✨ 맞춤" : cat}
            </button>
          );
        })}
      </div>

      {/* 읽기 현황 — 클릭 시 완료한 기도만 보기 토글 */}
      {(readIds.size > 0 || showReadOnly) && (
        <button
          style={{
            ...styles.statsBar,
            backgroundColor: showReadOnly ? "#0D9488" : "#F0FDFA",
            color: showReadOnly ? "#FFFFFF" : "#0D9488",
          }}
          onClick={() => setShowReadOnly((v) => !v)}
        >
          <span>
            🙏 {showReadOnly
              ? `완료한 기도만 보는 중 • 해제`
              : `${readIds.size}개 기도 완료 • 보기`}
          </span>
        </button>
      )}

      {/* 결과 없음 */}
      {filtered.length === 0 && (
        <div style={styles.empty}>
          {showReadOnly
            ? "이 카테고리에서 완료한 기도가 없어요."
            : selectedCategory === "맞춤"
            ? "프로필에 맞는 기도를 찾지 못했어요. 관심 영역을 조정해보세요."
            : "이 카테고리에 기도가 없어요."}
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
              boxShadow: isRead
                ? "inset 4px 0 0 #0D9488, 0 1px 4px rgba(0,0,0,0.04)"
                : "0 1px 4px rgba(0,0,0,0.04)",
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
  container: { padding: "8px 16px 16px" },
  profileBanner: {
    width: "100%", padding: "14px 16px", marginBottom: "12px",
    backgroundColor: "#ECFDF5", color: "#0F766E",
    borderRadius: "12px", border: "1px solid #A7F3D0",
    fontSize: "14px", fontWeight: 600, cursor: "pointer",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  bannerArrow: { fontSize: "20px", color: "#0D9488" },
  profileInfo: {
    width: "100%", padding: "10px 14px", marginBottom: "12px",
    backgroundColor: "#F9FAFB", borderRadius: "10px",
    border: "none", cursor: "pointer",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  profileBadge: {
    fontSize: "13px", fontWeight: 600, color: "#374151",
  },
  profileEdit: {
    fontSize: "12px", color: "#0D9488", fontWeight: 700,
  },
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
    width: "100%",
    padding: "10px 16px", backgroundColor: "#F0FDFA",
    borderRadius: "12px", marginBottom: "16px",
    fontSize: "13px", fontWeight: 700, color: "#0D9488",
    textAlign: "center" as const,
    border: "none", cursor: "pointer",
    transition: "background-color 0.2s, color 0.2s",
  },
  empty: {
    padding: "40px 16px", textAlign: "center" as const,
    color: "#9CA3AF", fontSize: "14px",
  },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  card: {
    backgroundColor: "#FFFFFF", borderRadius: "16px",
    overflow: "hidden",
    transition: "box-shadow 0.3s",
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
