import { useEffect, useMemo, useRef, useState } from "react";
import {
  GRATITUDE_MAX_LENGTH,
  addGratitudeEntry,
  getGratitudeEntries,
  removeGratitudeEntry,
  type GratitudeEntry,
} from "../lib/gratitude";
import { completeMission } from "../lib/missions";
import { track } from "../lib/analytics";
import { personalize, shareMessage } from "../lib/share";

function formatDateLabel(epochMs: number): string {
  const d = new Date(epochMs);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `오늘 ${hh}:${mm}`;
  if (isYesterday) return `어제 ${hh}:${mm}`;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (d.getFullYear() === now.getFullYear()) return `${m}월 ${day}일`;
  return `${d.getFullYear()}.${m}.${day}`;
}

interface WriteModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (content: string) => void;
}

function WriteModal({ open, onClose, onSubmit }: WriteModalProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setText("");
    // 모달 열림 직후 포커스 — 키보드 자동 활성화
    const t = setTimeout(() => textareaRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(trimmed);
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal aria-label="감사일기 쓰기">
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.handle} aria-hidden />

        <div style={styles.header}>
          <h2 style={styles.title}>🙏 오늘의 감사</h2>
          <button style={styles.closeBtn} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div style={styles.subtitle}>오늘 감사한 일을 적어보세요.</div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            if (v.length > GRATITUDE_MAX_LENGTH) {
              setText(v.slice(0, GRATITUDE_MAX_LENGTH));
            } else {
              setText(v);
            }
          }}
          placeholder="작은 일이라도 좋아요. 마음이 따뜻해진 순간을 떠올려보세요."
          style={styles.textarea}
          rows={6}
        />

        <div style={styles.metaRow}>
          <span style={styles.charCount}>
            {trimmed.length}/{GRATITUDE_MAX_LENGTH}
          </span>
        </div>

        <button
          style={{ ...styles.amenBtn, ...(canSubmit ? {} : styles.amenBtnDisabled) }}
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          🕊️ 아멘
        </button>
      </div>
      <button
        style={styles.overlayBackdrop}
        onClick={onClose}
        aria-label="배경 닫기"
        tabIndex={-1}
      />
    </div>
  );
}

interface JournalListProps {
  entries: GratitudeEntry[];
  onDelete: (id: string) => void;
  onShare: (entry: GratitudeEntry) => void;
}

function JournalList({ entries, onDelete, onShare }: JournalListProps) {
  if (entries.length === 0) {
    return (
      <div style={styles.empty}>
        <span style={styles.emptyIcon}>🙏</span>
        <span style={styles.emptyTitle}>아직 감사일기가 없어요</span>
        <span style={styles.emptyDesc}>
          오른쪽 위 <b>＋</b> 버튼으로 첫 감사를 적어보세요.
        </span>
      </div>
    );
  }
  return (
    <div style={styles.list}>
      {entries.map((e) => (
        <article key={e.id} style={styles.entry}>
          <div style={styles.entryHeader}>
            <span style={styles.entryDate}>{formatDateLabel(e.createdAt)}</span>
            <div style={styles.entryActions}>
              <button
                style={styles.shareBtn}
                onClick={() => onShare(e)}
                aria-label="공유"
              >
                📤
              </button>
              <button
                style={styles.deleteBtn}
                onClick={() => {
                  if (window.confirm("이 감사일기를 삭제할까요?")) onDelete(e.id);
                }}
                aria-label="삭제"
              >
                ×
              </button>
            </div>
          </div>
          <div style={styles.entryContent}>{e.content}</div>
        </article>
      ))}
    </div>
  );
}

interface SectionProps {
  /** 섹션 펼침 토글. 기본 true. */
  defaultOpen?: boolean;
}

export default function GratitudeJournal({ defaultOpen = true }: SectionProps) {
  const [entries, setEntries] = useState<GratitudeEntry[]>(() => getGratitudeEntries());
  const [writeOpen, setWriteOpen] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const refresh = () => setEntries(getGratitudeEntries());
    window.addEventListener("gratitude:changed", refresh);
    return () => window.removeEventListener("gratitude:changed", refresh);
  }, []);

  // 미션 패널의 "감사일기 1편 쓰기" 항목 클릭 → 작성 모달 자동 열기
  useEffect(() => {
    const onInvoke = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id?: string } | null;
      if (detail?.id === "gratitude") {
        setOpen(true);
        setWriteOpen(true);
      }
    };
    window.addEventListener("mission:invoke", onInvoke);
    return () => window.removeEventListener("mission:invoke", onInvoke);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const showToast = (text: string, ms = 2200) => {
    setToast(text);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), ms);
  };

  const handleSubmit = (content: string) => {
    const entry = addGratitudeEntry(content);
    if (entry) {
      completeMission("gratitude"); // 미션 트래킹 (오늘 active에 있으면 자동으로 완료 표시)
      track.click("gratitude_entry_added", { length: content.length });
      showToast("감사일기를 기록했어요 🙏");
      setOpen(true); // 작성 후 자동으로 펼치기
    }
    setWriteOpen(false);
  };

  const handleDelete = (id: string) => {
    removeGratitudeEntry(id);
    track.click("gratitude_entry_deleted", { id });
    showToast("일기를 삭제했어요");
  };

  const handleShare = async (entry: GratitudeEntry) => {
    const heading = personalize({
      withName: (name) => `🙏 ${name}님의 감사일기 · ${formatDateLabel(entry.createdAt)}`,
      fallback: `🙏 감사일기 · ${formatDateLabel(entry.createdAt)}`,
    });
    const message = `${heading}\n\n${entry.content}`;
    const res = await shareMessage(message);
    track.click("gratitude_entry_share", {
      id: entry.id,
      length: entry.content.length,
      ok: res.ok,
    });
    if (!res.ok) showToast("공유가 지원되지 않는 환경이에요");
  };

  const recentSummary = useMemo(() => {
    if (entries.length === 0) return null;
    const latest = entries[0];
    return `최근: ${formatDateLabel(latest.createdAt)}`;
  }, [entries]);

  return (
    <>
      <section style={styles.sectionWrap} aria-label="감사일기">
        <div style={styles.sectionHeader}>
          <button
            style={styles.sectionToggle}
            onClick={() => {
              const next = !open;
              setOpen(next);
              track.click("gratitude_section_toggle", { expanded: next });
            }}
            aria-expanded={open}
          >
            <span style={styles.sectionEmoji}>🙏</span>
            <div style={styles.sectionTitleWrap}>
              <span style={styles.sectionTitle}>감사일기</span>
              <span style={styles.sectionSubtitle}>
                {entries.length > 0
                  ? `${entries.length}개 · ${recentSummary}`
                  : "오늘의 감사를 적어보세요"}
              </span>
            </div>
            <span style={styles.sectionCaret}>{open ? "▴" : "▾"}</span>
          </button>
          <button
            style={styles.addBtn}
            onClick={() => {
              track.click("gratitude_writer_open");
              setOpen(true);
              setWriteOpen(true);
            }}
            aria-label="감사일기 쓰기"
          >
            ＋
          </button>
        </div>

        {open && (
          <div style={styles.sectionBody}>
            <JournalList
              entries={entries}
              onDelete={handleDelete}
              onShare={handleShare}
            />
          </div>
        )}
      </section>

      <WriteModal
        open={writeOpen}
        onClose={() => setWriteOpen(false)}
        onSubmit={handleSubmit}
      />

      {toast && (
        <div style={styles.toast} role="status">
          {toast}
        </div>
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  // ─ 섹션 (기도 탭 내부) ─────────────────────────
  sectionWrap: {
    backgroundColor: "#FFFFFF",
    borderRadius: "16px",
    border: "1px solid #FDE68A",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    marginBottom: "12px",
    overflow: "hidden",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
  },
  sectionToggle: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 12px 14px 16px",
    border: "none",
    cursor: "pointer",
    backgroundColor: "transparent",
    textAlign: "left" as const,
    minWidth: 0,
  },
  addBtn: {
    flexShrink: 0,
    width: "36px",
    height: "36px",
    marginRight: "12px",
    borderRadius: "50%",
    border: "none",
    backgroundColor: "#0D9488",
    color: "#FFFFFF",
    fontSize: "20px",
    fontWeight: 900,
    lineHeight: 1,
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(13, 148, 136, 0.28)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  sectionEmoji: { fontSize: "22px", lineHeight: 1 },
  sectionTitleWrap: { flex: 1, minWidth: 0 },
  sectionTitle: {
    display: "block",
    fontSize: "15px",
    fontWeight: 800,
    color: "#92400E",
  },
  sectionSubtitle: {
    display: "block",
    fontSize: "12px",
    color: "#A16207",
    marginTop: "2px",
  },
  sectionCaret: { fontSize: "12px", color: "#92400E", fontWeight: 800 },
  sectionBody: { padding: "8px 12px 16px" },

  // ─ 빈 상태 ─────────────────────────
  empty: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "6px",
    padding: "24px 16px",
    textAlign: "center" as const,
  },
  emptyIcon: { fontSize: "32px", marginBottom: "4px" },
  emptyTitle: { fontSize: "14px", fontWeight: 800, color: "#374151" },
  emptyDesc: { fontSize: "12px", color: "#6B7280", lineHeight: 1.5 },

  // ─ 리스트 ─────────────────────────
  list: { display: "flex", flexDirection: "column" as const, gap: "8px" },
  entry: {
    backgroundColor: "#FFFBEB",
    borderRadius: "12px",
    border: "1px solid #FDE68A",
    padding: "10px 12px",
  },
  entryHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "6px",
  },
  entryDate: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#92400E",
    letterSpacing: "0.2px",
  },
  entryActions: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  shareBtn: {
    width: "26px",
    height: "22px",
    borderRadius: "100px",
    border: "none",
    backgroundColor: "rgba(146,64,14,0.08)",
    color: "#92400E",
    fontSize: "12px",
    lineHeight: 1,
    cursor: "pointer",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    border: "none",
    backgroundColor: "rgba(146,64,14,0.08)",
    color: "#92400E",
    fontSize: "16px",
    fontWeight: 700,
    lineHeight: 1,
    cursor: "pointer",
    padding: 0,
  },
  entryContent: {
    fontSize: "14px",
    color: "#1F2937",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "keep-all" as const,
  },

  // ─ 모달 ─────────────────────────
  overlay: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 1500,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  overlayBackdrop: {
    position: "fixed" as const,
    inset: 0,
    border: "none",
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: -1,
    cursor: "default",
  },
  sheet: {
    width: "100%",
    maxWidth: "480px",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: "20px",
    borderTopRightRadius: "20px",
    padding: "8px 20px calc(20px + env(safe-area-inset-bottom, 0px))",
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
    zIndex: 1,
  },
  handle: {
    width: "40px",
    height: "4px",
    borderRadius: "2px",
    backgroundColor: "#E5E7EB",
    margin: "6px auto 8px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 900,
    color: "#111827",
    letterSpacing: "-0.3px",
  },
  closeBtn: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    backgroundColor: "#F3F4F6",
    color: "#6B7280",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
  },
  subtitle: {
    fontSize: "13px",
    color: "#6B7280",
    lineHeight: 1.5,
    marginTop: "-4px",
  },
  textarea: {
    width: "100%",
    minHeight: "120px",
    maxHeight: "260px",
    padding: "12px 14px",
    fontSize: "15px",
    lineHeight: 1.6,
    border: "1px solid #E5E7EB",
    borderRadius: "12px",
    resize: "vertical" as const,
    outline: "none",
    backgroundColor: "#FAFAFA",
    color: "#111827",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  },
  metaRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "-4px",
  },
  charCount: { fontSize: "11px", color: "#9CA3AF" },
  amenBtn: {
    padding: "14px",
    borderRadius: "14px",
    border: "none",
    backgroundColor: "#0D9488",
    color: "#FFFFFF",
    fontSize: "16px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(13, 148, 136, 0.25)",
  },
  amenBtnDisabled: {
    backgroundColor: "#E5E7EB",
    color: "#9CA3AF",
    cursor: "not-allowed",
    boxShadow: "none",
  },

  // ─ 토스트 ─────────────────────────
  toast: {
    position: "fixed" as const,
    left: "50%",
    transform: "translateX(-50%)",
    bottom: "calc(160px + env(safe-area-inset-bottom, 0px))",
    padding: "10px 16px",
    borderRadius: "100px",
    backgroundColor: "rgba(17, 24, 39, 0.92)",
    color: "#FFFFFF",
    fontSize: "13px",
    fontWeight: 700,
    boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
    zIndex: 1600,
    pointerEvents: "none" as const,
  },
};
