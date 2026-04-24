import { useState } from "react";
import VerseAudio from "./VerseAudio";
import { shareMessage } from "../lib/share";
import { track } from "../lib/analytics";

interface ReadAlongModeProps {
  title: string;
  content: string;
  onClose: () => void;
  reference?: string;
  verseText?: string;
  category?: string;
}

export default function ReadAlongMode({ title, content, onClose, reference, verseText, category }: ReadAlongModeProps) {
  const sentences = content
    .split(/(?<=[.!?다요세라니])\s+/)
    .filter((s) => s.trim().length > 0);

  const [currentIdx, setCurrentIdx] = useState(0);
  const finished = currentIdx >= sentences.length;

  const progress = ((currentIdx) / sentences.length) * 100;

  // 완료 화면
  if (finished) {
    return (
      <div style={styles.overlay}>
        <div style={styles.doneCard}>
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>🙏</div>
          <div style={styles.doneTitle}>기도를 마쳤습니다</div>
          <div style={styles.doneSubtitle}>"{title}"</div>
          <div style={styles.doneText}>
            {sentences.length}문장을 따라 읽으셨습니다
          </div>

          {reference && (
            <div style={styles.doneVerseBox}>
              <div style={styles.doneVerseLabel}>오늘의 말씀 · {reference}</div>
              {verseText && <div style={styles.doneVerseText}>{verseText}</div>}
              <div style={styles.doneVerseAudio}>
                <VerseAudio reference={reference} verseText={verseText} />
              </div>
            </div>
          )}

          <div style={styles.doneActions}>
            <button
              style={styles.doneShareButton}
              onClick={async () => {
                const parts = [
                  `🙏 기도를 마쳤습니다`,
                  `"${title}"`,
                  content,
                ];
                if (reference) {
                  parts.push("");
                  parts.push(`📖 ${reference}`);
                  if (verseText) parts.push(verseText);
                }
                const res = await shareMessage(parts.join("\n"));
                track.click("prayer_read_along_share", { category, ok: res.ok });
              }}
            >
              📤 공유하기
            </button>
            <button style={styles.doneButton} onClick={onClose}>
              아멘 🕊️
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay}>
      {/* 헤더 */}
      <div style={styles.header}>
        <button style={styles.closeButton} onClick={onClose}>✕</button>
        <div style={styles.headerTitle}>따라 읽기</div>
        <div style={styles.headerCount}>{currentIdx + 1}/{sentences.length}</div>
      </div>

      {/* 프로그레스 */}
      <div style={styles.progressBar}>
        <div style={{ ...styles.progressFill, width: `${progress}%` }} />
      </div>

      {/* 기도문 제목 */}
      <div style={styles.prayerTitle}>{title}</div>

      {/* 전체 문장 (현재 강조) */}
      <div
        style={styles.sentenceArea}
        onClick={() => setCurrentIdx((i) => i + 1)}
      >
        <div style={styles.sentenceList}>
          {sentences.map((s, i) => (
            <div
              key={i}
              style={{
                ...styles.sentence,
                opacity: i < currentIdx ? 0.25 : i === currentIdx ? 1 : 0.15,
                fontSize: i === currentIdx ? "24px" : "16px",
                fontWeight: i === currentIdx ? 700 : 400,
                color: i < currentIdx ? "#0D9488" : i === currentIdx ? "#111827" : "#D1D5DB",
                transform: i === currentIdx ? "scale(1)" : "scale(0.95)",
                transition: "all 0.3s ease",
                marginBottom: i === currentIdx ? "20px" : "8px",
                marginTop: i === currentIdx ? "20px" : "0",
              }}
            >
              {i < currentIdx && <span style={{ marginRight: "6px" }}>✓</span>}
              {s}
            </div>
          ))}
        </div>

        {/* 탭 안내 */}
        <div style={styles.tapHint}>
          <div style={styles.tapIcon}>👆</div>
          <div>화면을 탭하면 다음 문장으로</div>
        </div>
      </div>

      {/* 하단 버튼 */}
      <div style={styles.bottomBar}>
        <button
          style={styles.prevButton}
          onClick={(e) => {
            e.stopPropagation();
            if (currentIdx > 0) setCurrentIdx((i) => i - 1);
          }}
          disabled={currentIdx === 0}
        >
          ← 이전
        </button>
        <button
          style={styles.skipButton}
          onClick={(e) => {
            e.stopPropagation();
            setCurrentIdx(sentences.length);
          }}
        >
          전체 완료 →
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 200,
    backgroundColor: "#FFFFFF",
    display: "flex", flexDirection: "column",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px",
  },
  closeButton: {
    width: "36px", height: "36px", borderRadius: "50%",
    backgroundColor: "#F3F4F6", border: "none", cursor: "pointer",
    fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: "16px", fontWeight: 800, color: "#111827" },
  headerCount: { fontSize: "14px", fontWeight: 700, color: "#0D9488" },
  progressBar: {
    height: "4px", backgroundColor: "#E5E7EB", borderRadius: "2px",
    margin: "0 16px 16px", overflow: "hidden",
  },
  progressFill: {
    height: "100%", backgroundColor: "#0D9488", borderRadius: "2px",
    transition: "width 0.3s ease",
  },
  prayerTitle: {
    fontSize: "14px", fontWeight: 700, color: "#9CA3AF",
    textAlign: "center" as const, padding: "0 16px 8px",
  },
  sentenceArea: {
    flex: 1, padding: "16px 24px", cursor: "pointer",
    overflowY: "auto", display: "flex", flexDirection: "column",
    justifyContent: "center",
  },
  sentenceList: {
    flex: 1, display: "flex", flexDirection: "column",
    justifyContent: "center",
  },
  sentence: {
    lineHeight: "1.6", letterSpacing: "-0.3px",
    wordBreak: "keep-all" as const,
    textAlign: "center" as const,
  },
  tapHint: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "4px", padding: "16px 0",
    fontSize: "13px", color: "#D1D5DB", fontWeight: 600,
  },
  tapIcon: {
    fontSize: "20px", opacity: 0.5,
  },
  bottomBar: {
    display: "flex", justifyContent: "space-between",
    padding: "12px 16px",
    paddingBottom: "env(safe-area-inset-bottom, 16px)",
    borderTop: "1px solid #F3F4F6",
  },
  prevButton: {
    padding: "10px 20px", borderRadius: "10px",
    backgroundColor: "#F3F4F6", color: "#6B7280",
    fontSize: "14px", fontWeight: 600, border: "none", cursor: "pointer",
  },
  skipButton: {
    padding: "10px 20px", borderRadius: "10px",
    backgroundColor: "transparent", color: "#9CA3AF",
    fontSize: "14px", fontWeight: 600, border: "none", cursor: "pointer",
  },
  doneCard: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", padding: "32px 24px",
    overflowY: "auto",
  },
  doneTitle: { fontSize: "24px", fontWeight: 900, color: "#111827", marginBottom: "8px" },
  doneSubtitle: { fontSize: "16px", color: "#0D9488", fontWeight: 600, marginBottom: "16px", textAlign: "center" as const },
  doneText: { fontSize: "14px", color: "#9CA3AF", marginBottom: "24px" },
  doneVerseBox: {
    width: "100%", maxWidth: "400px",
    backgroundColor: "#F0FDFA", borderRadius: "16px",
    padding: "20px", marginBottom: "24px",
    border: "1px solid #CCFBF1",
  },
  doneVerseLabel: {
    fontSize: "12px", fontWeight: 800, color: "#0D9488",
    letterSpacing: "0.5px", marginBottom: "10px",
  },
  doneVerseText: {
    fontSize: "15px", color: "#134E4A", lineHeight: 1.7,
    marginBottom: "12px", wordBreak: "keep-all" as const,
  },
  doneVerseAudio: {
    display: "flex", justifyContent: "center",
  },
  doneActions: {
    display: "flex", gap: "10px", width: "100%", maxWidth: "400px",
  },
  doneShareButton: {
    flex: 1, padding: "14px", borderRadius: "14px",
    backgroundColor: "#F3F4F6", color: "#374151",
    fontSize: "15px", fontWeight: 800,
    border: "1px solid #E5E7EB", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
  },
  doneButton: {
    flex: 1, padding: "14px", borderRadius: "14px",
    backgroundColor: "#0D9488", color: "#FFFFFF",
    fontSize: "15px", fontWeight: 800, border: "none", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
  },
};
