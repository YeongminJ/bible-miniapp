import { useState, useEffect, useRef, useCallback } from "react";
import VerseAudio from "./VerseAudio";
import { showInterstitialAd } from "../lib/ad";

const MAX_LIVES = 2;

interface Quiz {
  id: number;
  category: string;
  difficulty: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  reference: string;
  verseText?: string;
}

type Difficulty = "전체" | "쉬움" | "보통" | "어려움";

export default function QuizTab() {
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [dailyQuizzes, setDailyQuizzes] = useState<Quiz[]>([]);
  const [lives, setLives] = useState(MAX_LIVES);
  const [adLoading, setAdLoading] = useState(false);
  const [adNotice, setAdNotice] = useState<string | null>(null);
  const [showHeartBreak, setShowHeartBreak] = useState(false);
  const [streak, setStreak] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [pointPopup, setPointPopup] = useState<{ text: string; key: number } | null>(null);
  const [timer, setTimer] = useState(10);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 타이머 시작
  useEffect(() => {
    if (difficulty === null || finished || selected !== null) return;
    setTimer(10);
    stopTimer();
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          stopTimer();
          // 시간 초과 = 오답 처리
          setSelected(-1);
          setLives((l) => Math.max(0, l - 1));
          setStreak(0);
          setShowHeartBreak(true);
          setTimeout(() => setShowHeartBreak(false), 750);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return stopTimer;
  }, [currentIndex, difficulty, finished, selected, stopTimer]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/quizzes.json`)
      .then((r) => r.json())
      .then(setAllQuizzes);
  }, []);

  const startQuiz = (diff: Difficulty) => {
    setDifficulty(diff);
    const pool = diff === "전체"
      ? allQuizzes
      : allQuizzes.filter((q) => q.difficulty === diff);
    const seed = Date.now();
    const shuffled = [...pool].sort(() => Math.sin(seed + Math.random()) - 0.5);
    setDailyQuizzes(shuffled.slice(0, 5));
    setCurrentIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
    setLives(MAX_LIVES);
    setStreak(0);
    setTotalPoints(0);
    setShowConfetti(false);
  };

  // 난이도 선택 화면
  if (difficulty === null) {
    return (
      <div style={styles.container}>
        <div style={styles.levelSelect}>
          <div style={styles.levelIcon}>📖</div>
          <div style={styles.levelTitle}>성경 퀴즈</div>
          <div style={styles.levelSubtitle}>난이도를 선택하세요</div>
          <div style={styles.levelButtons}>
            {(["쉬움", "보통", "어려움", "전체"] as Difficulty[]).map((diff) => (
              <button
                key={diff}
                style={{
                  ...styles.levelButton,
                  ...(diff === "쉬움" ? { backgroundColor: "#DCFCE7", color: "#166534" } :
                    diff === "보통" ? { backgroundColor: "#FEF3C7", color: "#92400E" } :
                    diff === "어려움" ? { backgroundColor: "#FEE2E2", color: "#991B1B" } :
                    { backgroundColor: "#F0FDFA", color: "#0D9488" }),
                }}
                onClick={() => startQuiz(diff)}
              >
                <span style={styles.levelEmoji}>
                  {diff === "쉬움" ? "🌱" : diff === "보통" ? "🌿" : diff === "어려움" ? "🌳" : "🎯"}
                </span>
                <span style={styles.levelLabel}>{diff}</span>
                <span style={styles.levelCount}>
                  {diff === "전체"
                    ? `${allQuizzes.length}문제`
                    : `${allQuizzes.filter((q) => q.difficulty === diff).length}문제`}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (dailyQuizzes.length === 0) {
    return <div style={styles.loading}>퀴즈를 불러오는 중...</div>;
  }

  // 결과 화면
  if (finished) {
    if (score === 5 && !showConfetti) {
      setShowConfetti(true);
    }
    return (
      <div style={styles.container}>
        {/* 폭죽 효과 */}
        {showConfetti && (
          <div style={styles.confettiContainer}>
            {Array.from({ length: 30 }, (_, i) => (
              <div key={i} style={{
                ...styles.confettiPiece,
                left: `${Math.random() * 100}%`,
                backgroundColor: ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899"][i % 6],
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1 + Math.random() * 1.5}s`,
                width: `${6 + Math.random() * 6}px`,
                height: `${6 + Math.random() * 6}px`,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              }} />
            ))}
          </div>
        )}
        <div style={styles.resultCard}>
          <div style={styles.resultIcon}>
            {score >= 4 ? "🏆" : score >= 2 ? "👏" : "📖"}
          </div>
          <div style={styles.resultScore}>{score}/5</div>
          <div style={styles.resultPoints}>⭐ {totalPoints}점</div>
          <div style={styles.resultText}>
            {score === 5 ? "🎉 퍼펙트! 성경 박사시네요!"
              : score >= 3 ? "잘하셨어요! 말씀을 잘 알고 계시네요."
              : "더 많은 말씀을 읽어보아요!"}
          </div>
          <div style={styles.resultButtons}>
            <button style={styles.retryButton} onClick={() => startQuiz(difficulty)}>
              다시 도전하기
            </button>
            <button style={styles.backButton} onClick={() => setDifficulty(null)}>
              난이도 변경
            </button>
          </div>
        </div>
      </div>
    );
  }

  const quiz = dailyQuizzes[currentIndex];

  return (
    <div style={styles.container}>
      {/* 하트 깨짐 애니메이션 */}
      {showHeartBreak && (
        <div style={styles.heartOverlay}>
          <div style={styles.heartBreakAnim}>
            <span style={styles.heartLeft}>💔</span>
          </div>
        </div>
      )}

      {/* 스타일 태그 */}
      <style>{`
        @keyframes heartShake {
          0% { transform: scale(0.7); opacity: 1; }
          15% { transform: scale(1.2) rotate(-5deg); }
          30% { transform: scale(1.1) rotate(5deg); }
          45% { transform: scale(0.95) rotate(-3deg); }
          60% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(0.3) translateY(30px); opacity: 0; }
        }
        @keyframes timerPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes pointFloat {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-60px) scale(1.3); opacity: 0; }
        }
        @keyframes streakGlow {
          0%, 100% { text-shadow: 0 0 4px rgba(249,115,22,0.3); }
          50% { text-shadow: 0 0 12px rgba(249,115,22,0.6); }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes overlayFade {
          0% { opacity: 0; }
          10% { opacity: 1; }
          60% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* 상단 바 */}
      <div style={styles.topBar}>
        <button style={styles.backLink} onClick={() => setDifficulty(null)}>← 난이도</button>
        <div style={styles.topRight}>
          <span style={styles.livesBadge} aria-label={`남은 목숨 ${lives}개`}>
            {Array.from({ length: MAX_LIVES }, (_, i) => (
              <span key={i} style={{ opacity: i < lives ? 1 : 0.25, filter: i < lives ? "none" : "grayscale(1)" }}>
                ❤️
              </span>
            ))}
          </span>
          <span style={styles.diffBadge}>{difficulty}</span>
        </div>
      </div>

      {/* 포인트 팝업 */}
      {pointPopup && (
        <div key={pointPopup.key} style={styles.pointPopup}>
          {pointPopup.text}
        </div>
      )}

      {/* 타이머 + 스트릭 + 점수 */}
      <div style={styles.gameBar}>
        <div style={styles.timerRing}>
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" fill="none" stroke="#E5E7EB" strokeWidth="4" />
            <circle
              cx="20" cy="20" r="16" fill="none"
              stroke={timer <= 3 ? "#EF4444" : "#0D9488"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 16}`}
              strokeDashoffset={`${2 * Math.PI * 16 * (1 - timer / 10)}`}
              transform="rotate(-90 20 20)"
              style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
            />
          </svg>
          <span style={{
            ...styles.timerText,
            color: timer <= 3 ? "#EF4444" : "#374151",
            animation: timer <= 3 ? "timerPulse 0.5s ease infinite" : "none",
          }}>{timer}</span>
        </div>
        {streak >= 2 && (
          <div style={styles.streakBadge}>
            🔥 {streak}연속!
          </div>
        )}
        <div style={styles.pointsBadge}>
          ⭐ {totalPoints}
        </div>
      </div>

      {/* 진행 바 */}
      <div style={styles.progressBar}>
        {dailyQuizzes.map((_, i) => (
          <div
            key={i}
            style={{
              ...styles.progressDot,
              backgroundColor: i <= currentIndex ? "#0D9488" : "#E5E7EB",
              opacity: i <= currentIndex ? 1 : 0.4,
            }}
          />
        ))}
      </div>

      {/* 카테고리 */}
      <div style={styles.badges}>
        <span style={styles.categoryBadge}>{quiz.category}</span>
      </div>

      {/* 질문 */}
      <div style={styles.questionNumber}>{currentIndex + 1}/5</div>
      <div style={styles.question}>{quiz.question}</div>

      {/* 선택지 */}
      <div style={styles.options}>
        {quiz.options.map((option, i) => {
          const isSelected = selected === i;
          const isCorrect = i === quiz.answer;
          const showResult = selected !== null;

          let bgColor = "#FFFFFF";
          let borderColor = "#E5E7EB";
          let textColor = "#1F2937";

          if (showResult) {
            if (isCorrect) {
              bgColor = "#DCFCE7"; borderColor = "#22C55E"; textColor = "#166534";
            } else if (isSelected) {
              bgColor = "#FEE2E2"; borderColor = "#EF4444"; textColor = "#991B1B";
            }
          } else if (isSelected) {
            borderColor = "#0D9488"; bgColor = "#F0FDFA";
          }

          return (
            <button
              key={i}
              style={{
                ...styles.option,
                backgroundColor: bgColor,
                borderColor, color: textColor,
              }}
              onClick={() => {
                if (selected !== null) return;
                stopTimer();
                setSelected(i);
                if (i === quiz.answer) {
                  const newStreak = streak + 1;
                  setStreak(newStreak);
                  setScore((s) => s + 1);
                  const bonus = newStreak >= 3 ? 300 : newStreak >= 2 ? 200 : 100;
                  const timeBonus = timer >= 7 ? 50 : timer >= 4 ? 25 : 0;
                  const pts = bonus + timeBonus;
                  setTotalPoints((p) => p + pts);
                  const label = newStreak >= 3 ? `🔥x${newStreak} +${pts}` : newStreak >= 2 ? `🔥 +${pts}` : `+${pts}`;
                  setPointPopup({ text: label, key: Date.now() });
                  setTimeout(() => setPointPopup(null), 800);
                } else {
                  setStreak(0);
                  setLives((l) => Math.max(0, l - 1));
                  setShowHeartBreak(true);
                  setTimeout(() => setShowHeartBreak(false), 750);
                }
              }}
            >
              <span style={styles.optionLabel}>{String.fromCharCode(65 + i)}</span>
              {option}
              {showResult && isCorrect && " ✓"}
            </button>
          );
        })}
      </div>

      {/* 해설 + 오디오 재생 */}
      {selected !== null && (
        <div style={styles.explanation}>
          <div style={styles.explanationTitle}>📖 해설</div>
          <div style={styles.explanationText}>{quiz.explanation}</div>
          <div style={{ marginTop: "12px" }}>
            <VerseAudio reference={quiz.reference} verseText={quiz.verseText} />
          </div>
          {lives === 0 ? (
            <>
              <button
                style={{ ...styles.nextButton, ...styles.adButton, opacity: adLoading ? 0.7 : 1 }}
                disabled={adLoading}
                onClick={async () => {
                  setAdLoading(true);
                  setAdNotice(null);
                  const result = await showInterstitialAd();
                  setAdLoading(false);
                  if (!result.shown) {
                    // 광고가 표시 안 됐어도 게임 진행은 막지 않음
                    const messages: Record<string, string> = {
                      "unsupported": "광고를 지원하지 않는 환경이라 그냥 이어가요.",
                      "load-timeout": "광고 응답이 늦어 그냥 이어갈게요.",
                      "load-error": "광고를 불러오지 못했어요. 그냥 이어갈게요.",
                      "show-timeout": "광고 표시가 끝나지 않아 이어가요.",
                      "show-failed": "광고 표시에 실패했어요. 이어갈게요.",
                      "show-error": "광고 오류가 있었어요. 이어갈게요.",
                    };
                    setAdNotice(messages[result.reason] ?? "이어갈게요.");
                    setTimeout(() => setAdNotice(null), 2400);
                  }
                  setLives(MAX_LIVES);
                  if (currentIndex < 4) {
                    setCurrentIndex((i) => i + 1);
                    setSelected(null);
                  } else {
                    setFinished(true);
                  }
                }}
              >
                {adLoading ? "광고 준비 중..." : "📺 광고 보고 계속하기"}
              </button>
              {adNotice && <div style={styles.adNotice}>{adNotice}</div>}
            </>
          ) : (
            <button
              style={styles.nextButton}
              onClick={() => {
                if (currentIndex < 4) {
                  setCurrentIndex((i) => i + 1);
                  setSelected(null);
                } else {
                  setFinished(true);
                }
              }}
            >
              {currentIndex < 4 ? "다음 문제" : "결과 보기"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: "8px 20px 20px", minHeight: "100%" },
  loading: { textAlign: "center", padding: "40px", color: "#9CA3AF" },
  // Level select
  levelSelect: { textAlign: "center" as const, paddingTop: "16px" },
  levelIcon: { fontSize: "56px", marginBottom: "16px" },
  levelTitle: { fontSize: "28px", fontWeight: 900, color: "#111827", letterSpacing: "-1px" },
  levelSubtitle: { fontSize: "15px", color: "#6B7280", marginTop: "8px", marginBottom: "32px" },
  levelButtons: { display: "flex", flexDirection: "column", gap: "12px" },
  levelButton: {
    display: "flex", alignItems: "center", gap: "12px",
    padding: "18px 20px", borderRadius: "16px", border: "none",
    cursor: "pointer", fontSize: "16px", fontWeight: 700, textAlign: "left" as const,
  },
  levelEmoji: { fontSize: "24px" },
  levelLabel: { flex: 1 },
  levelCount: { fontSize: "13px", opacity: 0.7 },
  // Top bar
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  topRight: { display: "flex", alignItems: "center", gap: "8px" },
  backLink: { fontSize: "14px", fontWeight: 600, color: "#0D9488", background: "none", border: "none", cursor: "pointer" },
  diffBadge: { fontSize: "12px", fontWeight: 700, padding: "4px 12px", borderRadius: "100px", backgroundColor: "#F0FDFA", color: "#0D9488" },
  livesBadge: {
    display: "inline-flex", alignItems: "center", gap: "2px",
    padding: "4px 10px", borderRadius: "100px", backgroundColor: "#FEF2F2",
    fontSize: "14px", lineHeight: 1,
  },
  adButton: {
    backgroundColor: "#F59E0B",
  },
  adNotice: {
    marginTop: "10px", padding: "10px 12px", borderRadius: "10px",
    backgroundColor: "#FEF3C7", color: "#92400E",
    fontSize: "13px", fontWeight: 600, textAlign: "center" as const,
  },
  // Game bar
  gameBar: {
    display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px",
  },
  timerRing: {
    position: "relative" as const,
    width: "40px", height: "40px",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  timerText: {
    position: "absolute" as const,
    fontSize: "14px", fontWeight: 900,
  },
  streakBadge: {
    padding: "4px 12px", borderRadius: "100px",
    backgroundColor: "#FFF7ED", color: "#EA580C",
    fontSize: "13px", fontWeight: 800,
    animation: "streakGlow 1s ease infinite",
  },
  pointsBadge: {
    marginLeft: "auto",
    padding: "4px 12px", borderRadius: "100px",
    backgroundColor: "#FFFBEB", color: "#B45309",
    fontSize: "13px", fontWeight: 800,
  },
  pointPopup: {
    position: "fixed" as const, top: "40%", left: "50%",
    transform: "translateX(-50%)", zIndex: 1000,
    fontSize: "28px", fontWeight: 900, color: "#F59E0B",
    animation: "pointFloat 0.8s ease forwards",
    pointerEvents: "none" as const,
    textShadow: "0 2px 8px rgba(245,158,11,0.3)",
  },
  resultPoints: {
    fontSize: "20px", fontWeight: 800, color: "#B45309", marginBottom: "8px",
  },
  confettiContainer: {
    position: "fixed" as const, inset: 0, zIndex: 998,
    pointerEvents: "none" as const, overflow: "hidden",
  },
  confettiPiece: {
    position: "absolute" as const, top: "-10px",
    animation: "confettiFall 2s ease forwards",
  },
  heartOverlay: {
    position: "fixed" as const, inset: 0, zIndex: 999,
    display: "flex", alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    pointerEvents: "none" as const,
    animation: "overlayFade 0.75s ease forwards",
  },
  heartBreakAnim: {
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  heartLeft: {
    fontSize: "56px",
    animation: "heartShake 0.75s ease forwards",
    filter: "drop-shadow(0 4px 24px rgba(239,68,68,0.4))",
  },
  // Progress
  progressBar: { display: "flex", gap: "8px", marginBottom: "24px" },
  progressDot: { flex: 1, height: "4px", borderRadius: "2px" },
  badges: { display: "flex", gap: "8px", marginBottom: "16px" },
  categoryBadge: { padding: "5px 14px", borderRadius: "100px", fontSize: "13px", fontWeight: 800, backgroundColor: "#F0FDFA", color: "#0D9488", letterSpacing: "0.3px" },
  questionNumber: { fontSize: "13px", fontWeight: 800, color: "#9CA3AF", marginBottom: "10px", letterSpacing: "0.5px" },
  question: {
    fontSize: "23px", fontWeight: 800, color: "#0F172A",
    lineHeight: "1.45", marginBottom: "28px", letterSpacing: "-0.6px",
    wordBreak: "keep-all" as const,
  },
  options: { display: "flex", flexDirection: "column", gap: "10px" },
  option: {
    display: "flex", alignItems: "center", gap: "14px",
    padding: "18px 18px", borderRadius: "16px", border: "2px solid",
    fontSize: "16px", fontWeight: 600, textAlign: "left" as const,
    cursor: "pointer", width: "100%", background: "none",
    lineHeight: "1.45", letterSpacing: "-0.2px",
    wordBreak: "keep-all" as const,
  },
  optionLabel: {
    width: "32px", height: "32px", borderRadius: "10px",
    backgroundColor: "#F3F4F6", display: "flex", alignItems: "center",
    justifyContent: "center", fontSize: "14px", fontWeight: 800, flexShrink: 0,
  },
  explanation: {
    marginTop: "20px", padding: "20px 22px", backgroundColor: "#F8FAFC",
    borderRadius: "16px", borderLeft: "4px solid #0D9488",
  },
  explanationTitle: { fontSize: "13px", fontWeight: 800, color: "#0D9488", marginBottom: "10px", letterSpacing: "0.5px" },
  explanationText: {
    fontSize: "15px", color: "#1F2937", lineHeight: "1.75",
    marginBottom: "8px", wordBreak: "keep-all" as const, letterSpacing: "-0.2px",
  },
  nextButton: {
    width: "100%", padding: "16px", borderRadius: "14px", marginTop: "18px",
    backgroundColor: "#0D9488", color: "#FFFFFF", fontSize: "16px",
    fontWeight: 800, border: "none", cursor: "pointer", letterSpacing: "-0.2px",
  },
  // Result
  resultCard: {
    textAlign: "center" as const, padding: "48px 24px",
    backgroundColor: "#FFFFFF", borderRadius: "24px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  },
  resultIcon: { fontSize: "64px", marginBottom: "16px" },
  resultScore: { fontSize: "48px", fontWeight: 900, color: "#0D9488", marginBottom: "12px" },
  resultText: { fontSize: "16px", color: "#6B7280", marginBottom: "32px", lineHeight: "1.5" },
  resultButtons: { display: "flex", flexDirection: "column", gap: "12px" },
  retryButton: {
    padding: "14px 32px", borderRadius: "12px",
    backgroundColor: "#0D9488", color: "#FFFFFF",
    fontSize: "15px", fontWeight: 700, border: "none", cursor: "pointer",
  },
  backButton: {
    padding: "14px 32px", borderRadius: "12px",
    backgroundColor: "#F3F4F6", color: "#6B7280",
    fontSize: "15px", fontWeight: 700, border: "none", cursor: "pointer",
  },
};
