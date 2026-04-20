import { useState, useEffect } from "react";
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
    return (
      <div style={styles.container}>
        <div style={styles.resultCard}>
          <div style={styles.resultIcon}>
            {score >= 4 ? "🏆" : score >= 2 ? "👏" : "📖"}
          </div>
          <div style={styles.resultScore}>{score}/5</div>
          <div style={styles.resultText}>
            {score === 5 ? "완벽해요! 성경 박사시네요!"
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
                setSelected(i);
                if (i === quiz.answer) {
                  setScore((s) => s + 1);
                } else {
                  setLives((l) => Math.max(0, l - 1));
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
            <button
              style={{ ...styles.nextButton, ...styles.adButton, opacity: adLoading ? 0.7 : 1 }}
              disabled={adLoading}
              onClick={async () => {
                setAdLoading(true);
                await showInterstitialAd();
                setAdLoading(false);
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
  container: { padding: "20px 16px", minHeight: "100%" },
  loading: { textAlign: "center", padding: "40px", color: "#9CA3AF" },
  // Level select
  levelSelect: { textAlign: "center" as const, paddingTop: "32px" },
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
  // Progress
  progressBar: { display: "flex", gap: "8px", marginBottom: "24px" },
  progressDot: { flex: 1, height: "4px", borderRadius: "2px" },
  badges: { display: "flex", gap: "8px", marginBottom: "16px" },
  categoryBadge: { padding: "4px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: 700, backgroundColor: "#F0FDFA", color: "#0D9488" },
  questionNumber: { fontSize: "13px", fontWeight: 700, color: "#9CA3AF", marginBottom: "8px" },
  question: { fontSize: "20px", fontWeight: 800, color: "#111827", lineHeight: "1.4", marginBottom: "24px", letterSpacing: "-0.5px" },
  options: { display: "flex", flexDirection: "column", gap: "12px" },
  option: {
    display: "flex", alignItems: "center", gap: "12px",
    padding: "16px", borderRadius: "16px", border: "2px solid",
    fontSize: "15px", fontWeight: 600, textAlign: "left" as const,
    cursor: "pointer", width: "100%", background: "none",
  },
  optionLabel: {
    width: "28px", height: "28px", borderRadius: "8px",
    backgroundColor: "#F3F4F6", display: "flex", alignItems: "center",
    justifyContent: "center", fontSize: "13px", fontWeight: 800, flexShrink: 0,
  },
  explanation: {
    marginTop: "20px", padding: "20px", backgroundColor: "#F8FAFC",
    borderRadius: "16px", borderLeft: "4px solid #0D9488",
  },
  explanationTitle: { fontSize: "14px", fontWeight: 700, color: "#0D9488", marginBottom: "8px" },
  explanationText: { fontSize: "14px", color: "#374151", lineHeight: "1.6", marginBottom: "8px" },
  nextButton: {
    width: "100%", padding: "14px", borderRadius: "12px", marginTop: "16px",
    backgroundColor: "#0D9488", color: "#FFFFFF", fontSize: "15px",
    fontWeight: 700, border: "none", cursor: "pointer",
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
