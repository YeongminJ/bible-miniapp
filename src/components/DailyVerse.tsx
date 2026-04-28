import { useEffect, useRef, useState } from "react";
import { getSchemeUri } from "@apps-in-toss/web-framework";
import { getAudioUrlFromRef } from "../utils/audioUrl";
import { track } from "../lib/analytics";
import { shareMessage } from "../lib/share";
import { completeMission } from "../lib/missions";

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

// 진입 URL(앱인토스 스킴 또는 브라우저)에서 verse/ref 쿼리 파라미터 추출
function getOverrideRef(): string | null {
  try {
    let search = "";
    try {
      const scheme = getSchemeUri?.() ?? "";
      const q = scheme.indexOf("?");
      if (q >= 0) search = scheme.slice(q);
    } catch { /* ignore — 브라우저 */ }
    if (!search && typeof window !== "undefined") {
      search = window.location.search || "";
    }
    if (!search) return null;
    const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    return p.get("verse") || p.get("ref") || null;
  } catch {
    return null;
  }
}

export default function DailyVerse() {
  const overrideRef = typeof window !== "undefined" ? getOverrideRef() : null;
  const [isOverride, setIsOverride] = useState(Boolean(overrideRef));
  const [verse, setVerse] = useState<Verse | null>(() => {
    if (overrideRef) return null;
    const cached = loadCached();
    return cached && cached.date === todayKey() ? cached.verse : null;
  });
  const [expanded, setExpanded] = useState(true);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState<"v1" | "v2">("v2");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current = null;
    }
    setPlaying(false);
    setLoading(false);
  };

  const togglePlay = () => {
    if (!verse) return;
    if (playing || loading) { stopAudio(); return; }
    const url = getAudioUrlFromRef(verse.reference, voice);
    if (!url) return;
    setLoading(true);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onplaying = () => { setLoading(false); setPlaying(true); };
    audio.onended = () => { stopAudio(); };
    audio.onerror = () => { stopAudio(); };
    audio.play().catch(() => stopAudio());
    track.click("daily_verse_play", { reference: verse.reference, voice });
    completeMission("verse");
  };

  const toggleVoice = () => {
    stopAudio();
    const next = voice === "v1" ? "v2" : "v1";
    setVoice(next);
    track.click("daily_verse_voice_change", { voice: next });
  };

  useEffect(() => () => stopAudio(), []);

  // 카드 바깥(퀴즈/기도/인물 내부)의 버튼 등을 클릭하면 자동 접기
  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (cardRef.current && target && cardRef.current.contains(target)) return;
      // interactive element인지 간단 체크 (과도한 접힘 방지)
      const el = e.target as HTMLElement | null;
      if (!el) return;
      const interactive = el.closest("button, a, input, textarea, select, [role='button']");
      if (interactive) {
        setExpanded(false);
        stopAudio();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [expanded]);

  useEffect(() => {
    if (verse && !overrideRef) return;
    fetch(`${import.meta.env.BASE_URL}data/prayers.json`)
      .then((r) => r.json())
      .then((prayers: Prayer[]) => {
        const uniq = new Map<string, Verse>();
        for (const p of prayers) {
          if (p.relatedVerse && p.relatedVerseText && !uniq.has(p.relatedVerse)) {
            uniq.set(p.relatedVerse, { reference: p.relatedVerse, text: p.relatedVerseText });
          }
        }
        const list = [...uniq.values()];
        if (list.length === 0) return;

        // 1) 푸시/공유 링크 파라미터로 지정된 말씀이 있으면 우선 표시
        if (overrideRef) {
          const found = list.find((v) => v.reference === overrideRef);
          if (found) {
            setVerse(found);
            track.impression("daily_verse_shown", { reference: found.reference, source: "deeplink" });
            return;
          }
          // 매칭 실패 시 기본 로직으로 폴백
          setIsOverride(false);
        }

        // 2) 기본: 날짜 기반 선택
        const picked = list[dayIndex(list.length)];
        setVerse(picked);
        saveCached(todayKey(), picked);
        track.impression("daily_verse_shown", { reference: picked.reference, source: "daily" });
      })
      .catch(() => {/* silent */});
  }, [verse, overrideRef]);

  if (!verse) return null;

  return (
    <div ref={cardRef} style={{ ...styles.card, ...(isOverride ? styles.cardHighlight : {}) }}>
      <button
        style={styles.topRow}
        onClick={() => {
          setExpanded((v) => !v);
          track.click("daily_verse_toggle", { expanded: !expanded });
        }}
        aria-expanded={expanded}
      >
        <span style={styles.label}>{isOverride ? "📬" : "📖"}</span>
        <span style={styles.reference}>
          {isOverride ? "전해드린 말씀" : "오늘의 말씀"} · {verse.reference}
        </span>
        <span style={styles.toggleIcon}>{expanded ? "▾" : "›"}</span>
      </button>

      {expanded && (
        <div style={styles.expandedArea}>
          <div style={styles.verseText}>
            <div style={styles.audioCol}>
              <button
                style={styles.playBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                aria-label={playing ? "일시정지" : "재생"}
              >
                {loading ? "⏳" : playing ? "⏸" : "▶"}
              </button>
              <button
                style={styles.voiceBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVoice();
                }}
                aria-label={`음성 전환 (현재 ${voice === "v2" ? "남성" : "여성"})`}
              >
                {voice === "v2" ? "👨" : "👩"}
              </button>
            </div>
            <span>{verse.text}</span>
          </div>
          <div style={styles.actions}>
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
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    margin: "8px 16px 4px",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #F0FDFA 0%, #ECFDF5 100%)",
    border: "1px solid #CCFBF1",
  },
  cardHighlight: {
    background: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
    border: "1px solid #FCD34D",
  },
  topRow: {
    display: "flex", alignItems: "center", gap: "6px",
    width: "100%", padding: "8px 12px",
    border: "none", background: "transparent",
    cursor: "pointer",
  },
  label: { fontSize: "14px", lineHeight: 1 },
  reference: {
    flex: 1, fontSize: "12px", fontWeight: 700, color: "#0F766E",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    textAlign: "left" as const, letterSpacing: "-0.2px",
  },
  toggleIcon: { color: "#0D9488", fontSize: "14px", fontWeight: 800 },
  expandedArea: {
    padding: "0 12px 10px",
    borderTop: "1px solid rgba(13,148,136,0.12)",
    marginTop: "2px", paddingTop: "10px",
  },
  verseText: {
    fontSize: "13px", color: "#134E4A", lineHeight: 1.65,
    wordBreak: "keep-all" as const,
    marginBottom: "10px",
    display: "flex", alignItems: "flex-start", gap: "8px",
  },
  audioCol: {
    flexShrink: 0,
    display: "flex", flexDirection: "column" as const, gap: "4px",
    alignItems: "center",
  },
  playBtn: {
    width: "26px", height: "26px", borderRadius: "50%",
    backgroundColor: "#FFFFFF", color: "#0D9488",
    fontSize: "12px", fontWeight: 800,
    border: "1px solid #A7F3D0", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0, lineHeight: 1,
  },
  voiceBtn: {
    width: "26px", height: "22px", borderRadius: "11px",
    backgroundColor: "#FFFFFF",
    fontSize: "14px",
    border: "1px solid #A7F3D0", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0, lineHeight: 1,
  },
  actions: {
    display: "flex", alignItems: "center", gap: "6px",
    justifyContent: "flex-end",
  },
  shareBtn: {
    padding: "6px 10px", borderRadius: "100px",
    backgroundColor: "#FFFFFF", color: "#0D9488",
    fontSize: "13px", fontWeight: 800,
    border: "1px solid #A7F3D0", cursor: "pointer",
    lineHeight: 1,
  },
};
