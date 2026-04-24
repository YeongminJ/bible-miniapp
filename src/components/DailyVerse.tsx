import { useEffect, useState } from "react";
import VerseAudio from "./VerseAudio";
import { track } from "../lib/analytics";
import { shareMessage } from "../lib/share";

interface Prayer {
  id: number;
  relatedVerse: string;
  relatedVerseText: string;
}

interface Verse {
  reference: string;
  text: string;
}

// 날짜 기준으로 고정된 index 선택 → 같은 날 = 같은 말씀
function dayIndex(len: number): number {
  if (len <= 0) return 0;
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const day = Math.floor(diff / (1000 * 60 * 60 * 24));
  return Math.abs(day) % len;
}

const CACHE_KEY = "dailyVerse.v1";

function loadCached(): { date: string; verse: Verse } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveCached(date: string, verse: Verse) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ date, verse })); } catch { /* ignore */ }
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export default function DailyVerse() {
  const [verse, setVerse] = useState<Verse | null>(() => {
    const cached = loadCached();
    return cached && cached.date === todayKey() ? cached.verse : null;
  });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (verse) return;
    fetch(`${import.meta.env.BASE_URL}data/prayers.json`)
      .then((r) => r.json())
      .then((prayers: Prayer[]) => {
        // 중복 reference 제거
        const uniq = new Map<string, Verse>();
        for (const p of prayers) {
          if (p.relatedVerse && p.relatedVerseText && !uniq.has(p.relatedVerse)) {
            uniq.set(p.relatedVerse, { reference: p.relatedVerse, text: p.relatedVerseText });
          }
        }
        const list = [...uniq.values()];
        if (list.length === 0) return;
        const picked = list[dayIndex(list.length)];
        setVerse(picked);
        saveCached(todayKey(), picked);
        track.impression("daily_verse_shown", { reference: picked.reference });
      })
      .catch(() => {/* silent */});
  }, [verse]);

  if (!verse) return null;

  return (
    <div style={styles.card}>
      <button
        style={styles.topRow}
        onClick={() => {
          setExpanded((v) => !v);
          track.click("daily_verse_toggle", { expanded: !expanded });
        }}
      >
        <span style={styles.label}>📖 오늘의 말씀</span>
        <span style={styles.reference}>{verse.reference}</span>
        <span style={styles.toggleIcon}>{expanded ? "▾" : "▸"}</span>
      </button>

      <div
        style={{
          ...styles.verseText,
          maxHeight: expanded ? "300px" : "44px",
          WebkitLineClamp: expanded ? "none" : 2,
        }}
      >
        {verse.text}
      </div>

      <div style={styles.actions}>
        <VerseAudio reference={verse.reference} verseText={verse.text} />
        <button
          style={styles.shareBtn}
          onClick={async () => {
            const res = await shareMessage(`📖 오늘의 말씀 · ${verse.reference}\n\n${verse.text}`);
            track.click("daily_verse_share", { reference: verse.reference, ok: res.ok });
          }}
        >
          📤 공유
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    margin: "12px 16px 8px",
    padding: "12px 14px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #F0FDFA 0%, #ECFDF5 100%)",
    border: "1px solid #CCFBF1",
  },
  topRow: {
    display: "flex", alignItems: "center", gap: "8px",
    width: "100%", padding: 0, border: "none", background: "transparent",
    cursor: "pointer", marginBottom: "8px",
  },
  label: {
    fontSize: "12px", fontWeight: 800, color: "#0D9488", letterSpacing: "0.3px",
  },
  reference: {
    flex: 1, fontSize: "12px", fontWeight: 700, color: "#0F766E",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    textAlign: "left" as const,
  },
  toggleIcon: { color: "#0D9488", fontSize: "14px" },
  verseText: {
    fontSize: "14px", color: "#134E4A", lineHeight: 1.6,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical" as const,
    transition: "max-height 0.25s ease",
    wordBreak: "keep-all" as const,
    marginBottom: "10px",
  },
  actions: {
    display: "flex", alignItems: "center", gap: "8px",
  },
  shareBtn: {
    marginLeft: "auto",
    padding: "8px 12px", borderRadius: "100px",
    backgroundColor: "#FFFFFF", color: "#0D9488",
    fontSize: "12px", fontWeight: 800,
    border: "1px solid #A7F3D0", cursor: "pointer",
  },
};
