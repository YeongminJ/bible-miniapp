import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadIndex,
  loadBook,
  type BookData,
  type BookMeta,
  type ChapterData,
} from "../lib/bible-data";
import {
  TOTAL_BIBLE_CHAPTERS,
  getBookProgress,
  getNextChapter,
  getReadingState,
  getResumeTarget,
  getTotalProgress,
  hasAdShownToday,
  isAllCompleted,
  markAdShownToday,
  markVerseHeard,
  type BookProgress,
  type ReadingState,
} from "../lib/bible-reading";
import { showInterstitialAd, REWARD_AD_GROUP_ID } from "../lib/ad";
import { earnFromBibleReadingAd, isBibleReadEarnedToday } from "../lib/points";
import { track } from "../lib/analytics";
import { personalize, shareMessage } from "../lib/share";
import { getAudioUrl } from "../utils/audioUrl";

type Mode = "list" | "ad" | "playing" | "chapter_done" | "all_done";

export default function BibleReadingTab() {
  const [index, setIndex] = useState<BookMeta[]>([]);
  const [reading, setReading] = useState<ReadingState>(() => getReadingState());
  const [mode, setMode] = useState<Mode>("list");
  const [paused, setPaused] = useState(false);
  // 광고 직후 / 첫 진입 시 사용자가 명시적으로 "시작" 탭을 눌러야 재생 시작.
  // 모바일 webview에서 user gesture 보존이 어려워 자동재생이 막히는 케이스 방지.
  const [awaitingStart, setAwaitingStart] = useState(false);
  const [book, setBook] = useState<BookData | null>(null);
  const [chapterIdx, setChapterIdx] = useState<number>(0);
  const [verseIdx, setVerseIdx] = useState<number>(0);
  const [voice] = useState<"v1" | "v2">("v2");
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  // 오늘 광고 봤는지 — list view 라벨용 + reactive 갱신.
  // hasAdShownToday()는 매번 localStorage 읽지만, 마운트 시/광고 후/visibility 변경 시 sync.
  const [adShownToday, setAdShownToday] = useState<boolean>(() => hasAdShownToday());

  // 단일 audio element — verse 변경 시 src만 교체. 새 Audio() 다발 생성으로 인한 race 회피.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 핸들러 안에서 항상 최신 state를 읽기 위한 ref. 이게 없으면 onended 클로저가
  // 옛 verseIdx를 보고 일찍 chapter_done으로 빠짐.
  const stateRef = useRef({
    book: null as BookData | null,
    chapterIdx: 0,
    verseIdx: 0,
    mode: "list" as Mode,
  });
  const verseListRef = useRef<HTMLDivElement>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // state ↔ ref 동기화 (모든 렌더마다 갱신)
  useEffect(() => {
    stateRef.current = { book, chapterIdx, verseIdx, mode };
  }, [book, chapterIdx, verseIdx, mode]);

  // 진입 시 index 로드
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const idx = await loadIndex();
      if (cancelled) return;
      setIndex(idx);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 단일 audio element 1회 생성 + unmount 정리
  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    audioRef.current = a;
    return () => {
      a.pause();
      a.src = "";
      audioRef.current = null;
    };
  }, []);

  // 외부 진행 상태 변경 동기화 + 백그라운드 시 일시정지
  useEffect(() => {
    const refresh = () => setReading(getReadingState());
    window.addEventListener("bibleReading:changed", refresh);
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        const a = audioRef.current;
        if (a && !a.paused) {
          a.pause();
          setPaused(true);
        }
      } else if (document.visibilityState === "visible") {
        // 다시 보이게 되면 광고 노출 여부 재검사 (날짜 바뀌었을 가능성)
        setAdShownToday(hasAdShownToday());
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("bibleReading:changed", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
  }, []);

  const showFeedback = (text: string, ms = 2200) => {
    setFeedback(text);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), ms);
  };

  const totalProgress = useMemo(
    () => (index.length > 0 ? getTotalProgress(index, reading) : { done: 0, total: TOTAL_BIBLE_CHAPTERS, percent: 0 }),
    [index, reading],
  );
  const allDone = useMemo(
    () => (index.length > 0 ? isAllCompleted(index, reading) : false),
    [index, reading],
  );
  const resumeTarget = useMemo(
    () => (index.length > 0 ? getResumeTarget(index, reading) : null),
    [index, reading],
  );

  // 현재 절 끝까지 들었음 → 기록 + 다음 절 진행
  const handleVerseEnded = useCallback(() => {
    const cur = stateRef.current;
    if (!cur.book) return;
    const ch = cur.book.chapters[cur.chapterIdx];
    if (!ch) return;
    const verse = ch.verses[cur.verseIdx];
    if (!verse) return;
    // 이 절 완료 → 즉시 기록
    const next = markVerseHeard(cur.book.id, ch.chapter, verse.verse);
    setReading(next);
    track.click("bible_reading_verse_done", {
      bookId: cur.book.id,
      chapter: ch.chapter,
      verse: verse.verse,
    });

    // 다음 절 또는 장 완료 분기 — 즉시 다음 절로
    if (cur.verseIdx < ch.verses.length - 1) {
      setVerseIdx((i) => i + 1);
    } else {
      handleChapterDoneInternal();
    }
  }, []);

  const handleChapterDoneInternal = useCallback(() => {
    const cur = stateRef.current;
    if (!cur.book) return;
    const ch = cur.book.chapters[cur.chapterIdx];
    if (!ch) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    track.click("bible_reading_chapter_done", {
      bookId: cur.book.id,
      chapter: ch.chapter,
    });
    // 마지막 책의 마지막 장이면 final
    if (cur.book.id === 66 && ch.chapter === cur.book.chapter_count) {
      setMode("all_done");
      return;
    }
    setMode("chapter_done");
  }, []);

  const handleVerseError = useCallback((url: string) => {
    console.warn("[bible-reading] audio error", url);
    // 짧은 딜레이 후 다음 절로 (혹시 모를 빈 절 방어)
    setTimeout(() => handleVerseEnded(), 200);
  }, [handleVerseEnded]);

  // ──────────────────────────────────────────────
  // 절 변경 시 audio src 교체 + 재생
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "playing") return;
    const audio = audioRef.current;
    if (!audio) return;
    if (!book) return;
    const ch = book.chapters[chapterIdx];
    if (!ch) return;
    const verse = ch.verses[verseIdx];
    if (!verse) return;

    const url = getAudioUrl(book.name_kr, ch.chapter, verse.verse, voice);
    if (!url) {
      // URL 못 만들면 기록만 하고 다음 절로
      handleVerseEnded();
      return;
    }

    // 핸들러는 ref-기반 함수를 사용 (closure stale 방지)
    const onEnded = () => handleVerseEnded();
    const onError = () => handleVerseError(url);

    audio.onended = onEnded;
    audio.onerror = onError;
    audio.src = url;
    // 첫 진입(awaitingStart) 또는 사용자 일시정지 상태면 자동재생 안 함.
    if (awaitingStart || paused) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.warn("[bible-reading] audio play rejected", err);
        setPaused(true);
      });
    }

    // 현재 절을 화면 중앙 근처로 — verseList 컨테이너 내부 스크롤
    requestAnimationFrame(() => {
      const container = verseListRef.current;
      const el = container?.querySelector<HTMLElement>(
        `[data-verse-idx="${verseIdx}"]`,
      );
      if (container && el) {
        const cRect = container.getBoundingClientRect();
        const eRect = el.getBoundingClientRect();
        const desired =
          eRect.top - cRect.top + container.scrollTop -
          (cRect.height - eRect.height) / 2;
        container.scrollTo({ top: Math.max(0, desired), behavior: "smooth" });
      }
    });

    return () => {
      // verse 바뀔 때 핸들러 해제 (이전 핸들러가 새 src에 매달리지 않도록)
      audio.onended = null;
      audio.onerror = null;
    };
  }, [mode, book, chapterIdx, verseIdx, voice, handleVerseEnded, handleVerseError]);

  // ──────────────────────────────────────────────
  // 통독 시작 — 광고는 하루에 한 번만, 같은 날 재진입은 광고 없이 즉시 시작
  // ──────────────────────────────────────────────
  const handleStartReading = async () => {
    if (mode !== "list") return;
    if (!resumeTarget) {
      showFeedback("이미 통독을 모두 마쳤어요 🎊");
      return;
    }
    track.click("bible_reading_start", {
      bookId: resumeTarget.bookId,
      chapter: resumeTarget.chapter,
      verse: resumeTarget.verse,
      progress: totalProgress.percent,
      ad_skipped_today: hasAdShownToday(),
    });

    if (!hasAdShownToday()) {
      setMode("ad");
      let adShown = false;
      try {
        // 리워드형 광고 키가 있으면 그걸 사용, 없으면 기본 전면광고로 fallback
        const adResult = await showInterstitialAd(
          REWARD_AD_GROUP_ID ? { adGroupId: REWARD_AD_GROUP_ID } : undefined,
        );
        adShown = adResult.shown;
        track.impression("bible_reading_ad_result", {
          shown: adResult.shown,
          reason: adResult.shown ? "dismissed" : adResult.reason,
          ad_type: REWARD_AD_GROUP_ID ? "rewarded" : "interstitial",
        });
      } catch {
        /* ignore */
      }
      // 광고가 실제로 노출된 경우에만 오늘 광고 락. 실패 시 다음 시도에 다시 시도 가능.
      if (adShown) {
        markAdShownToday();
        setAdShownToday(true);
        // 광고를 끝까지 본 경우에만 1원 적립. 같은 날 이미 받았으면 noop.
        if (!isBibleReadEarnedToday()) {
          const { earned } = earnFromBibleReadingAd();
          if (earned) {
            showFeedback("🎁 통독 광고 시청 보상 1원이 적립되었어요");
            track.click("bible_reading_ad_reward_earned", { amount: 1 });
          }
        }
      }
    }
    await beginPlayback(resumeTarget.bookId, resumeTarget.chapter, resumeTarget.verse);
  };

  // ──────────────────────────────────────────────
  // 재생 시작 (광고 없이) — startVerse 1-based
  // ──────────────────────────────────────────────
  const beginPlayback = async (bookId: number, chapter: number, startVerse: number) => {
    const data = await loadBook(bookId);
    if (!data) {
      showFeedback("책 데이터를 불러오지 못했어요. 다시 시도해 주세요.");
      setMode("list");
      return;
    }
    setBook(data);
    const chIdx = data.chapters.findIndex((c) => c.chapter === chapter);
    const finalChIdx = chIdx >= 0 ? chIdx : 0;
    setChapterIdx(finalChIdx);
    const ch = data.chapters[finalChIdx];
    // startVerse는 1-based. 절 인덱스(0-based)로 변환 + 범위 클램프.
    const startIdx = ch
      ? Math.max(0, Math.min(startVerse - 1, ch.verses.length - 1))
      : 0;
    setVerseIdx(startIdx);
    // 첫 진입 — 사용자가 "시작" 탭을 눌러야 실제 재생 시작
    setAwaitingStart(true);
    setPaused(true);
    setMode("playing");
  };

  // 다음 장 듣기 (광고 없이)
  const handleNextChapter = async () => {
    if (!book) return;
    const ch = book.chapters[chapterIdx];
    if (!ch) return;
    const next = getNextChapter(index, book.id, ch.chapter);
    if (!next) {
      setMode("all_done");
      return;
    }
    track.click("bible_reading_next_chapter", { from: `${book.id}:${ch.chapter}` });
    await beginPlayback(next.bookId, next.chapter, 1);
  };

  // 일시정지/재개 (awaitingStart 상태면 첫 시작 탭 역할)
  const togglePause = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      setPaused(false);
      if (awaitingStart) setAwaitingStart(false);
    } else {
      a.pause();
      setPaused(true);
    }
  };

  // 종료 (목록으로)
  const handleExit = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setMode("list");
    setPaused(false);
    setAwaitingStart(false);
    track.click("bible_reading_exit");
  };

  // 진행률 공유
  const handleShareProgress = async (extraMessage?: string): Promise<void> => {
    const headline = personalize({
      withName: (name) =>
        `📖 ${name}님이 성경 통독을 ${totalProgress.percent}% 진행 중!`,
      fallback: `📖 성경 통독 ${totalProgress.percent}% 진행 중!`,
    });
    const lines: string[] = [
      headline,
      `${totalProgress.done}/${totalProgress.total}장 완료`,
    ];
    if (extraMessage) {
      lines.push("");
      lines.push(extraMessage);
    }
    lines.push("");
    lines.push("함께 통독해보는 건 어때요?");
    const res = await shareMessage(lines.join("\n"));
    track.click("bible_reading_share_progress", {
      percent: totalProgress.percent,
      ok: res.ok,
    });
    if (!res.ok) showFeedback("공유가 지원되지 않는 환경이에요");
  };

  // ──────────────────────────────────────────────
  // 렌더링
  // ──────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingBox}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📖</div>
          <div style={{ fontSize: 14, color: "#9CA3AF", fontWeight: 600 }}>
            성경 데이터를 불러오는 중…
          </div>
        </div>
      </div>
    );
  }

  if (mode === "playing" && book) {
    const ch = book.chapters[chapterIdx];
    return (
      <PlayingView
        book={book}
        chapter={ch}
        verseIdx={verseIdx}
        paused={paused}
        awaitingStart={awaitingStart}
        verseListRef={verseListRef}
        onTogglePause={togglePause}
        onExit={handleExit}
      />
    );
  }

  if (mode === "ad") {
    const alreadyEarned = isBibleReadEarnedToday();
    return (
      <div style={styles.container}>
        <div style={styles.loadingBox}>
          <div style={styles.spinner} aria-hidden />
          <div style={{ fontSize: 14, color: "#374151", fontWeight: 700 }}>
            광고 준비 중…
          </div>
          {!alreadyEarned && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#0D9488", fontWeight: 700 }}>
              🎁 광고를 끝까지 보면 1원이 적립돼요
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === "chapter_done" && book) {
    const ch = book.chapters[chapterIdx];
    const bp = getBookProgress(book, reading);
    const next = getNextChapter(index, book.id, ch.chapter);
    return (
      <CompletionView
        title={`🎉 축하해요!`}
        subtitle={`${book.name_kr} ${ch.chapter}장 읽기를 완료했어요`}
        bookProgress={bp}
        bookName={book.name_kr}
        totalProgress={totalProgress}
        primaryAction={
          next
            ? {
                label: `다음 장 듣기 ▶ ${index.find((b) => b.id === next.bookId)?.name_kr ?? ""} ${next.chapter}장`,
                onClick: handleNextChapter,
              }
            : null
        }
        onExit={handleExit}
        onShare={() =>
          handleShareProgress(
            `방금 ${book.name_kr} ${ch.chapter}장을 끝냈어요!`,
          )
        }
        feedback={feedback}
      />
    );
  }

  if (mode === "all_done") {
    return (
      <div style={styles.container}>
        <div style={styles.finalCard}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>🎊</div>
          <div style={styles.finalTitle}>성경 통독 완료!</div>
          <div style={styles.finalSubtitle}>
            창세기부터 요한계시록까지 모두 들으셨어요.
          </div>
          <div style={styles.totalRow}>
            <ProgressBar percent={100} />
            <div style={styles.totalText}>
              {TOTAL_BIBLE_CHAPTERS}/{TOTAL_BIBLE_CHAPTERS}장 (100%)
            </div>
          </div>
          <button
            style={styles.shareBtn}
            onClick={() =>
              handleShareProgress("성경 전체 통독을 마쳤어요! 🎊")
            }
          >
            📤 완독 인증 공유
          </button>
          <button style={styles.secondaryBtn} onClick={handleExit}>
            목록으로
          </button>
        </div>
      </div>
    );
  }

  // mode === "list"
  return (
    <ListView
      index={index}
      reading={reading}
      totalProgress={totalProgress}
      allDone={allDone}
      resumeTarget={resumeTarget}
      adShownToday={adShownToday}
      onStart={handleStartReading}
      onShare={() => handleShareProgress()}
      feedback={feedback}
    />
  );
}

// ──────────────────────────────────────────────
// 하위 컴포넌트
// ──────────────────────────────────────────────

interface ListViewProps {
  index: BookMeta[];
  reading: ReadingState;
  totalProgress: { done: number; total: number; percent: number };
  allDone: boolean;
  resumeTarget: { bookId: number; chapter: number; verse: number } | null;
  adShownToday: boolean;
  onStart: () => void;
  onShare: () => void;
  feedback: string | null;
}

function ListView({
  index,
  reading,
  totalProgress,
  allDone,
  resumeTarget,
  adShownToday,
  onStart,
  onShare,
  feedback,
}: ListViewProps) {
  const ot = useMemo(() => index.filter((b) => b.testament === "OT"), [index]);
  const nt = useMemo(() => index.filter((b) => b.testament === "NT"), [index]);

  const resumeBookName = resumeTarget
    ? index.find((b) => b.id === resumeTarget.bookId)?.name_kr
    : null;

  return (
    <div style={styles.container}>
      <div style={styles.totalRow}>
        <div style={styles.totalLabel}>전체 진행률</div>
        <ProgressBar percent={totalProgress.percent} />
        <div style={styles.totalText}>
          {totalProgress.done}/{totalProgress.total}장 ({totalProgress.percent}%)
        </div>
      </div>

      <button
        style={{
          ...styles.startBtn,
          ...(allDone ? styles.startBtnAllDone : {}),
        }}
        onClick={onStart}
        disabled={allDone}
      >
        <span style={styles.startBtnIcon}>🎬</span>
        <div style={styles.startBtnTextWrap}>
          <div style={styles.startBtnTitle}>
            {allDone
              ? "✨ 통독 완료"
              : adShownToday
                ? resumeTarget
                  ? "통독 이어듣기"
                  : "통독 시작"
                : resumeTarget
                  ? "광고 보고 이어듣기 (+1원 적립)"
                  : "광고 보고 시작하기 (+1원 적립)"}
          </div>
          {!allDone && resumeBookName && resumeTarget && (
            <div style={styles.startBtnSub}>
              {resumeBookName} {resumeTarget.chapter}장 {resumeTarget.verse}절부터
            </div>
          )}
          {!allDone && !resumeTarget && (
            <div style={styles.startBtnSub}>창세기 1장 1절부터 자동 재생</div>
          )}
        </div>
      </button>

      <button style={styles.shareBtnSmall} onClick={onShare}>
        📤 진행률 공유
      </button>

      {feedback && <div style={styles.toast}>{feedback}</div>}

      <Section title="구약" emoji="📜" books={ot} reading={reading} />
      <Section title="신약" emoji="✝️" books={nt} reading={reading} />

      <div style={{ height: 24 }} />
    </div>
  );
}

interface SectionProps {
  title: string;
  emoji: string;
  books: BookMeta[];
  reading: ReadingState;
}

function Section({ title, emoji, books, reading }: SectionProps) {
  if (books.length === 0) return null;
  return (
    <section style={styles.section}>
      <h3 style={styles.sectionTitle}>
        <span style={{ marginRight: 6 }}>{emoji}</span>
        {title} <span style={styles.sectionCount}>({books.length}권)</span>
      </h3>
      <div style={styles.bookList}>
        {books.map((b) => {
          const bp = getBookProgress(b, reading);
          const isDone = bp.done >= bp.total;
          return (
            <div key={b.id} style={styles.bookRow}>
              <span style={styles.bookName}>{b.name_kr}</span>
              <div style={styles.bookProgressWrap}>
                <ProgressBar percent={bp.percent} small />
              </div>
              <span
                style={{
                  ...styles.bookCount,
                  ...(isDone ? styles.bookCountDone : {}),
                }}
              >
                {isDone ? "✓ 완독" : `${bp.done}/${bp.total}`}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface PlayingViewProps {
  book: BookData;
  chapter: ChapterData;
  verseIdx: number;
  paused: boolean;
  awaitingStart: boolean;
  verseListRef: React.RefObject<HTMLDivElement>;
  onTogglePause: () => void;
  onExit: () => void;
}

function PlayingView({
  book,
  chapter,
  verseIdx,
  paused,
  awaitingStart,
  verseListRef,
  onTogglePause,
  onExit,
}: PlayingViewProps) {
  return (
    <div style={styles.container}>
      <div style={styles.playingHeader}>
        <button style={styles.exitBtn} onClick={onExit} aria-label="나가기">
          ✕
        </button>
        <div style={styles.playingTitle}>
          {book.name_kr} {chapter.chapter}장
        </div>
        <div style={styles.playingMeta}>
          {verseIdx + 1}/{chapter.verses.length}절
        </div>
      </div>

      {chapter.summary && (
        <div style={styles.summaryBox}>
          <div style={styles.summaryLabel}>📌 장 요약</div>
          <div style={styles.summaryText}>{chapter.summary}</div>
        </div>
      )}

      <div ref={verseListRef} style={styles.verseList}>
        {chapter.verses.map((v, i) => {
          const isCurrent = i === verseIdx;
          const isPast = i < verseIdx;
          return (
            <div
              key={v.verse}
              data-verse-idx={i}
              style={{
                ...styles.verseRow,
                ...(isCurrent ? styles.verseRowCurrent : {}),
                ...(isPast ? styles.verseRowPast : {}),
              }}
            >
              <span style={styles.verseNum}>{v.verse}</span>
              <span style={styles.verseText}>{v.text}</span>
            </div>
          );
        })}
      </div>

      <div style={styles.playerBar}>
        <button
          style={{
            ...styles.playBtn,
            ...(awaitingStart ? styles.playBtnPulse : {}),
          }}
          onClick={onTogglePause}
        >
          {awaitingStart ? "▶ 시작" : paused ? "▶ 재개" : "⏸ 일시정지"}
        </button>
      </div>
    </div>
  );
}

interface CompletionViewProps {
  title: string;
  subtitle: string;
  bookProgress: BookProgress;
  bookName: string;
  totalProgress: { done: number; total: number; percent: number };
  primaryAction: { label: string; onClick: () => void } | null;
  onExit: () => void;
  onShare: () => void;
  feedback: string | null;
}

function CompletionView({
  title,
  subtitle,
  bookProgress,
  bookName,
  totalProgress,
  primaryAction,
  onExit,
  onShare,
  feedback,
}: CompletionViewProps) {
  return (
    <div style={styles.container}>
      <div style={styles.celebrationCard}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🎉</div>
        <div style={styles.celebrationTitle}>{title}</div>
        <div style={styles.celebrationSubtitle}>{subtitle}</div>

        <div style={styles.statsBlock}>
          <div style={styles.statRow}>
            <div style={styles.statLabel}>{bookName}</div>
            <ProgressBar percent={bookProgress.percent} />
            <div style={styles.statValue}>
              {bookProgress.done}/{bookProgress.total}장 ({bookProgress.percent}%)
            </div>
          </div>
          <div style={styles.statRow}>
            <div style={styles.statLabel}>전체 통독</div>
            <ProgressBar percent={totalProgress.percent} />
            <div style={styles.statValue}>
              {totalProgress.done}/{totalProgress.total}장 ({totalProgress.percent}%)
            </div>
          </div>
        </div>

        {primaryAction && (
          <button style={styles.primaryActionBtn} onClick={primaryAction.onClick}>
            {primaryAction.label}
          </button>
        )}
        <button style={styles.shareBtn} onClick={onShare}>
          📤 진행률 공유
        </button>
        <button style={styles.secondaryBtn} onClick={onExit}>
          목록으로
        </button>
      </div>
      {feedback && <div style={styles.toast}>{feedback}</div>}
    </div>
  );
}

function ProgressBar({ percent, small }: { percent: number; small?: boolean }) {
  return (
    <div
      style={{
        ...styles.progressTrack,
        ...(small ? { height: 4 } : {}),
      }}
      aria-hidden
    >
      <div
        style={{
          ...styles.progressFill,
          width: `${Math.min(100, Math.max(0, percent))}%`,
        }}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: "12px 16px 16px", minHeight: "100%" },
  loadingBox: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 16px",
    gap: 12,
  },
  spinner: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "3px solid #E5E7EB",
    borderTopColor: "#0D9488",
    animation: "dh-spin 0.8s linear infinite",
  },
  totalRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    border: "1px solid #E5E7EB",
    padding: "12px 14px",
    marginBottom: 10,
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "#0D9488",
    letterSpacing: "0.3px",
  },
  totalText: { fontSize: 13, fontWeight: 800, color: "#374151" },
  startBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 18px",
    borderRadius: 16,
    backgroundColor: "#0D9488",
    color: "#FFFFFF",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 6px 16px rgba(13,148,136,0.28)",
    marginBottom: 10,
    textAlign: "left" as const,
  },
  startBtnAllDone: {
    backgroundColor: "#F3F4F6",
    color: "#9CA3AF",
    boxShadow: "none",
    cursor: "not-allowed",
  },
  startBtnIcon: { fontSize: 28, lineHeight: 1 },
  startBtnTextWrap: { display: "flex", flexDirection: "column" as const, gap: 2 },
  startBtnTitle: { fontSize: 16, fontWeight: 900 },
  startBtnSub: { fontSize: 12, fontWeight: 600, opacity: 0.9 },
  shareBtnSmall: {
    display: "block",
    width: "100%",
    padding: "10px 14px",
    borderRadius: 12,
    backgroundColor: "#F0FDFA",
    color: "#0D9488",
    border: "1px solid #A7F3D0",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 16,
  },
  shareBtn: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 12,
    backgroundColor: "#F0FDFA",
    color: "#0D9488",
    border: "1px solid #A7F3D0",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    marginTop: 8,
  },
  section: {
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    border: "1px solid #E5E7EB",
    overflow: "hidden",
  },
  sectionTitle: {
    margin: 0,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 900,
    color: "#0F172A",
    backgroundColor: "#F9FAFB",
    borderBottom: "1px solid #E5E7EB",
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: 700,
    color: "#9CA3AF",
    marginLeft: 4,
  },
  bookList: { display: "flex", flexDirection: "column" as const },
  bookRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderBottom: "1px solid #F3F4F6",
  },
  bookName: {
    flexShrink: 0,
    width: 70,
    fontSize: 13,
    fontWeight: 700,
    color: "#1F2937",
  },
  bookProgressWrap: { flex: 1, minWidth: 0 },
  bookCount: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 800,
    color: "#9CA3AF",
    minWidth: 50,
    textAlign: "right" as const,
  },
  bookCountDone: { color: "#065F46" },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 100,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#0D9488",
    transition: "width 0.3s ease",
  },
  playingHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    padding: "0 4px",
  },
  exitBtn: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    backgroundColor: "#F3F4F6",
    color: "#6B7280",
    border: "none",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    padding: 0,
  },
  playingTitle: { flex: 1, fontSize: 17, fontWeight: 900, color: "#0F172A" },
  playingMeta: {
    fontSize: 12,
    fontWeight: 700,
    color: "#0D9488",
    backgroundColor: "#F0FDFA",
    padding: "4px 10px",
    borderRadius: 100,
    border: "1px solid #A7F3D0",
  },
  summaryBox: {
    backgroundColor: "#FFFBEB",
    border: "1px solid #FDE68A",
    borderRadius: 12,
    padding: "10px 12px",
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#92400E",
    marginBottom: 4,
  },
  summaryText: { fontSize: 13, color: "#92400E", lineHeight: 1.6 },
  verseList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    padding: "8px 4px",
    maxHeight: "calc(100vh - 320px)",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
  },
  verseRow: {
    display: "flex",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 8,
    transition: "background-color 0.2s",
  },
  verseRowCurrent: {
    backgroundColor: "#F0FDFA",
    border: "1px solid #A7F3D0",
  },
  verseRowPast: { opacity: 0.6 },
  verseNum: {
    flexShrink: 0,
    width: 28,
    fontSize: 12,
    fontWeight: 800,
    color: "#9CA3AF",
    textAlign: "right" as const,
    paddingTop: 2,
  },
  verseText: {
    fontSize: 14,
    lineHeight: 1.7,
    color: "#1F2937",
    wordBreak: "keep-all" as const,
  },
  playerBar: {
    position: "sticky" as const,
    bottom: 0,
    paddingTop: 12,
    backgroundColor: "#F6F6F9",
  },
  playBtn: {
    width: "100%",
    padding: "14px",
    borderRadius: 14,
    backgroundColor: "#0D9488",
    color: "#FFFFFF",
    border: "none",
    fontSize: 15,
    fontWeight: 900,
    cursor: "pointer",
  },
  playBtnPulse: {
    animation: "br-pulse 1.4s ease-in-out infinite",
  },
  celebrationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: "32px 20px 20px",
    textAlign: "center" as const,
    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
    marginTop: 20,
  },
  celebrationTitle: {
    fontSize: 22,
    fontWeight: 900,
    color: "#0F172A",
    marginBottom: 8,
  },
  celebrationSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
    lineHeight: 1.5,
  },
  statsBlock: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
    marginBottom: 20,
  },
  statRow: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: "10px 12px",
    textAlign: "left" as const,
  },
  statLabel: { fontSize: 12, fontWeight: 800, color: "#0D9488" },
  statValue: { fontSize: 12, fontWeight: 700, color: "#374151" },
  primaryActionBtn: {
    width: "100%",
    padding: "14px",
    borderRadius: 14,
    backgroundColor: "#0D9488",
    color: "#FFFFFF",
    border: "none",
    fontSize: 15,
    fontWeight: 900,
    cursor: "pointer",
    marginBottom: 8,
  },
  secondaryBtn: {
    width: "100%",
    padding: "12px",
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    color: "#6B7280",
    border: "none",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 8,
  },
  finalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: "40px 20px 24px",
    textAlign: "center" as const,
    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
    marginTop: 24,
  },
  finalTitle: {
    fontSize: 24,
    fontWeight: 900,
    color: "#0F172A",
    marginBottom: 8,
  },
  finalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 24,
    lineHeight: 1.5,
  },
  toast: {
    position: "fixed" as const,
    left: "50%",
    transform: "translateX(-50%)",
    bottom: "calc(140px + env(safe-area-inset-bottom, 0px))",
    padding: "10px 16px",
    borderRadius: 100,
    backgroundColor: "rgba(17,24,39,0.92)",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: 700,
    zIndex: 1600,
  },
};
