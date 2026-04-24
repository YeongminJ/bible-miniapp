import { useState, useEffect, useMemo } from "react";
import VerseAudio from "./VerseAudio";
import { track } from "../lib/analytics";
import { showInterstitialAd } from "../lib/ad";
import { shareMessage } from "../lib/share";

// 닉네임 · 닮은 인물 이력 저장 키
const NICKNAME_KEY = "userNickname.v1";
const MATCH_HISTORY_KEY = "characterMatchHistory.v1";

type MatchHistoryEntry = {
  characterId: number;
  name: string;
  virtue: string;
  nickname: string;
  timestamp: number;
};

function loadNickname(): string {
  try { return localStorage.getItem(NICKNAME_KEY) || ""; } catch { return ""; }
}
function saveNickname(v: string) {
  try { localStorage.setItem(NICKNAME_KEY, v); } catch { /* ignore */ }
}
function loadMatchHistory(): MatchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(MATCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveMatchHistory(list: MatchHistoryEntry[]) {
  try { localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(list.slice(0, 20))); } catch { /* ignore */ }
}

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

interface RelatedVerse {
  reference: string;
  text: string;
}

interface CharacterDetail {
  background?: string;
  personality?: string;
  events?: string[];
  strengths?: string[];
  relatedVerses?: RelatedVerse[];
  legacy?: string;
}

interface QuizOption {
  text: string;
  weights: Record<string, number>;
}

interface QuizQuestion {
  id: number;
  question: string;
  options: QuizOption[];
}

interface QuizData {
  traits: Record<string, string>;
  questions: QuizQuestion[];
  virtueToTraits: Record<string, string[]>;
  matchPoolIds: number[];
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

const R2_BASE = "https://pub-7f6f4f93019b41ba9d9ade42f6e1cd25.r2.dev";

function getCharacterImageUrl(id: number): string {
  return `${R2_BASE}/characters/${id.toString().padStart(3, "0")}.jpg`;
}

type QuizPhase = "intro" | "playing" | "result";

export default function CharacterTab() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [details, setDetails] = useState<Record<string, CharacterDetail>>({});
  const [quizData, setQuizData] = useState<QuizData | null>(null);

  const [filter, setFilter] = useState("전체");
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);

  const [quizPhase, setQuizPhase] = useState<QuizPhase>("intro");
  const [answers, setAnswers] = useState<number[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [matchedChar, setMatchedChar] = useState<Character | null>(null);
  const [lastAnswerIndex, setLastAnswerIndex] = useState<number | null>(null);
  const [adLoading, setAdLoading] = useState(false);
  const [nickname, setNickname] = useState(loadNickname);
  const [history, setHistory] = useState<MatchHistoryEntry[]>(loadMatchHistory);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [editingNickname, setEditingNickname] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/characters.json`).then((r) => r.json()),
      fetch(`${base}data/characterDetails.json`).then((r) => r.json()).catch(() => ({})),
      fetch(`${base}data/characterQuiz.json`).then((r) => r.json()).catch(() => null),
    ]).then(([chars, dets, quiz]) => {
      setCharacters(chars);
      setDetails(dets);
      setQuizData(quiz);
    });
  }, []);

  const filtered = useMemo(
    () => (filter === "전체" ? characters : characters.filter((c) => c.testament === filter)),
    [filter, characters]
  );

  function startQuiz() {
    setAnswers([]);
    setCurrentQuestion(0);
    setMatchedChar(null);
    setLastAnswerIndex(null);
    setAdLoading(false);
    setQuizPhase("playing");
  }

  function pickOption(optionIndex: number) {
    if (!quizData) return;
    const isLast = currentQuestion >= quizData.questions.length - 1;

    if (isLast) {
      // 마지막 질문: 자동으로 넘기지 않고 광고 게이트로 진입
      setLastAnswerIndex(optionIndex);
      return;
    }

    const nextAnswers = [...answers, optionIndex];
    setAnswers(nextAnswers);
    setCurrentQuestion((i) => i + 1);
  }

  function goBackQuestion() {
    if (currentQuestion === 0) {
      setQuizPhase("intro");
      return;
    }
    setLastAnswerIndex(null);
    setAnswers(answers.slice(0, -1));
    setCurrentQuestion((i) => i - 1);
  }

  async function handleWatchAdAndFinish() {
    if (!quizData || lastAnswerIndex === null) return;
    const finalAnswers = [...answers, lastAnswerIndex];
    setAdLoading(true);
    const result = await showInterstitialAd();
    track.impression("character_quiz_ad_result", {
      shown: result.shown,
      reason: result.shown ? "dismissed" : result.reason,
    });
    setAdLoading(false);
    finishQuiz(finalAnswers);
  }

  function finishQuiz(finalAnswers: number[]) {
    if (!quizData || characters.length === 0) return;

    const userTraits: Record<string, number> = {};
    quizData.questions.forEach((q, qi) => {
      const opt = q.options[finalAnswers[qi]];
      if (!opt) return;
      Object.entries(opt.weights).forEach(([key, val]) => {
        userTraits[key] = (userTraits[key] || 0) + val;
      });
    });

    const pool = characters.filter((c) => quizData.matchPoolIds.includes(c.id));

    let best: Character | null = null;
    let bestScore = -1;
    for (const c of pool) {
      const charTraits = quizData.virtueToTraits[c.keyVirtue] || [];
      let score = 0;
      charTraits.forEach((t, idx) => {
        const weight = idx === 0 ? 1.0 : 0.6;
        score += (userTraits[t] || 0) * weight;
      });
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }

    setMatchedChar(best);
    setQuizPhase("result");
    if (best) {
      track.impression("character_quiz_result", {
        character_id: best.id,
        name: best.name,
        virtue: best.keyVirtue,
      });
      const entry: MatchHistoryEntry = {
        characterId: best.id,
        name: best.name,
        virtue: best.keyVirtue,
        nickname,
        timestamp: Date.now(),
      };
      const next = [entry, ...history].slice(0, 20);
      setHistory(next);
      saveMatchHistory(next);
    }
  }

  async function shareMatchResult(char: Character) {
    const who = nickname ? `${nickname}님` : "나";
    const message = `${who}의 가장 닮은 성경 인물은 "${char.name} (${char.title})" 입니다!\n\n${char.summary}\n\n나도 테스트 하러 가기 👉`;
    const res = await shareMessage(message);
    track.click("character_match_share", { character_id: char.id, name: char.name, ok: res.ok });
    if (!res.ok) {
      setShareNotice("공유 기능을 지원하지 않는 환경이에요.");
      setTimeout(() => setShareNotice(null), 2500);
    }
  }

  function handleNicknameSave() {
    const v = nicknameDraft.trim().slice(0, 12);
    setNickname(v);
    saveNickname(v);
    setEditingNickname(false);
    track.click("character_nickname_save", { has_value: Boolean(v) });
  }

  function resetQuiz() {
    setMatchedChar(null);
    setAnswers([]);
    setCurrentQuestion(0);
    setLastAnswerIndex(null);
    setAdLoading(false);
    setQuizPhase("intro");
  }

  // ============ 상세 화면 ============
  if (selectedChar) {
    const colors = ERA_COLORS[selectedChar.era] || ["#374151", "#6B7280"];
    const detail = details[String(selectedChar.id)];
    const extraVerses = detail?.relatedVerses?.filter(
      (v) => v.reference !== selectedChar.keyVerse
    ) || [];

    return (
      <div style={styles.container}>
        <button
          style={styles.backButton}
          onClick={() => {
            track.click("character_detail_back", { character_id: selectedChar.id, name: selectedChar.name });
            setSelectedChar(null);
          }}
        >
          ← 목록으로
        </button>
        <div style={styles.detailCard}>
          <div style={{
            ...styles.heroBanner,
            background: `linear-gradient(160deg, ${colors[0]}, ${colors[1]})`,
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
            <div style={styles.sectionTitle}>📖 인물 소개</div>
            <div style={styles.sectionContent}>{selectedChar.summary}</div>
          </div>

          {detail?.background && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>🕯️ 배경과 시대</div>
              <div style={styles.sectionContent}>{detail.background}</div>
            </div>
          )}

          {detail?.personality && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>🎭 성품과 기질</div>
              <div style={styles.sectionContent}>{detail.personality}</div>
            </div>
          )}

          {detail?.events && detail.events.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>⏳ 주요 사건</div>
              <ul style={styles.eventList}>
                {detail.events.map((e, i) => (
                  <li key={i} style={styles.eventItem}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {detail?.strengths && detail.strengths.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>💪 대표 강점</div>
              <div style={styles.chipRow}>
                {detail.strengths.map((s) => (
                  <span key={s} style={styles.strengthChip}>{s}</span>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: "16px" }}>
            <div style={styles.sectionTitle}>🔖 핵심 말씀</div>
            <VerseAudio
              reference={selectedChar.keyVerse}
              verseText={selectedChar.keyVerseText}
            />
          </div>

          {extraVerses.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>📚 함께 읽으면 좋은 말씀</div>
              {extraVerses.map((v, i) => (
                <div key={i} style={styles.extraVerse}>
                  <div style={styles.extraVerseText}>"{v.text}"</div>
                  <div style={styles.extraVerseRef}>— {v.reference}</div>
                </div>
              ))}
            </div>
          )}

          {detail?.legacy && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>🌟 유산과 의미</div>
              <div style={styles.sectionContent}>{detail.legacy}</div>
            </div>
          )}

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

  // ============ 목록 화면 ============
  // 이전 매칭 이력 최신값 — intro에서 인물 카드 보여주고 '오늘의 말씀' 연동
  const lastMatch = history[0];
  const lastChar = lastMatch ? characters.find((c) => c.id === lastMatch.characterId) : null;

  return (
    <div style={styles.container}>
      {/* 이전 닮은 인물 배너 + 오늘의 말씀 */}
      {lastChar && quizPhase === "intro" && (
        <div style={styles.lastMatchCard}>
          <div style={styles.lastMatchHeader}>
            <span style={styles.lastMatchTag}>⭐ {lastMatch?.nickname ? `${lastMatch.nickname}님과` : "나와"} 닮은 인물</span>
          </div>
          <button
            style={styles.lastMatchInner}
            onClick={() => {
              track.click("character_last_match_open", { character_id: lastChar.id });
              setSelectedChar(lastChar);
            }}
          >
            <div style={styles.lastMatchRow}>
              <img
                src={getCharacterImageUrl(lastChar.id)}
                alt={lastChar.name}
                style={styles.lastMatchImage}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.lastMatchName}>{lastChar.name} · {lastChar.title}</div>
                <div style={styles.lastMatchVerseRef}>📖 {lastChar.keyVerse}</div>
                <div style={styles.lastMatchVerseText}>{lastChar.keyVerseText}</div>
              </div>
            </div>
          </button>
          <div style={styles.lastMatchActions}>
            <button
              style={styles.lastMatchShareBtn}
              onClick={() => shareMatchResult(lastChar)}
            >
              📤 공유하기
            </button>
            <button
              style={styles.lastMatchDetailBtn}
              onClick={() => {
                track.click("character_last_match_open", { character_id: lastChar.id, via: "detail_button" });
                setSelectedChar(lastChar);
              }}
            >
              자세히 보기 ›
            </button>
          </div>
        </div>
      )}

      {/* 매칭 퀴즈 섹션 */}
      {quizData && (
        <div style={styles.quizWrap}>
          {quizPhase === "intro" && (
            <div style={styles.quizIntro}>
              <div style={styles.quizSparkle}>✨</div>
              <div style={styles.quizTitle}>
                {lastChar ? "다시 한 번 닮은 인물을 찾아볼까요?" : "나와 닮은 성경 인물은 누구일까?"}
              </div>
              <div style={styles.quizDesc}>
                {quizData.questions.length}가지 질문으로 나와 가장 닮은 인물을 찾아보세요
              </div>
              <button
                style={styles.quizStartBtn}
                onClick={() => {
                  track.click("character_quiz_start");
                  startQuiz();
                }}
              >
                {lastChar ? "다시 하기" : "시작하기"}
              </button>
            </div>
          )}

          {quizPhase === "playing" && (
            <div style={styles.quizPlay}>
              <div style={styles.quizProgressRow}>
                <button style={styles.quizBackBtn} onClick={goBackQuestion}>
                  ←
                </button>
                <div style={styles.quizProgressText}>
                  {currentQuestion + 1} / {quizData.questions.length}
                </div>
                <div style={{ width: "32px" }} />
              </div>
              <div style={styles.quizProgressBar}>
                <div
                  style={{
                    ...styles.quizProgressFill,
                    width: `${((currentQuestion + 1) / quizData.questions.length) * 100}%`,
                  }}
                />
              </div>
              <div style={styles.quizQuestion}>
                {quizData.questions[currentQuestion].question}
              </div>
              <div style={styles.quizOptions}>
                {quizData.questions[currentQuestion].options.map((opt, i) => {
                  const isLast = currentQuestion >= quizData.questions.length - 1;
                  const isSelected = isLast && lastAnswerIndex === i;
                  return (
                    <button
                      key={`${quizData.questions[currentQuestion].id}-${i}`}
                      style={isSelected ? styles.quizOptionSelected : styles.quizOption}
                      disabled={adLoading}
                      onClick={(e) => {
                        (e.currentTarget as HTMLButtonElement).blur();
                        pickOption(i);
                      }}
                    >
                      {opt.text}
                    </button>
                  );
                })}
              </div>

              {currentQuestion >= quizData.questions.length - 1 && (
                <button
                  style={{
                    ...styles.quizAdButton,
                    opacity: lastAnswerIndex === null || adLoading ? 0.5 : 1,
                    cursor: lastAnswerIndex === null || adLoading ? "not-allowed" : "pointer",
                  }}
                  disabled={lastAnswerIndex === null || adLoading}
                  onClick={() => {
                    track.click("character_quiz_ad_requested");
                    handleWatchAdAndFinish();
                  }}
                >
                  {adLoading ? "광고 불러오는 중…" : "🎬 광고보고 나에게 맞는 인물 확인하기"}
                </button>
              )}
            </div>
          )}

          {quizPhase === "result" && matchedChar && (
            <div style={{
              ...styles.quizResult,
              background: `linear-gradient(160deg, ${(ERA_COLORS[matchedChar.era] || ["#374151", "#6B7280"])[0]}, ${(ERA_COLORS[matchedChar.era] || ["#374151", "#6B7280"])[1]})`,
            }}>
              <div style={styles.quizResultLabel}>
                {nickname ? `${nickname}님과` : "나와"} 가장 닮은 인물
              </div>
              <img
                src={getCharacterImageUrl(matchedChar.id)}
                alt={matchedChar.name}
                style={styles.quizResultImage}
              />
              <div style={styles.quizResultName}>{matchedChar.name}</div>
              <div style={styles.quizResultTitle}>{matchedChar.title}</div>
              <div style={styles.quizResultVirtue}>
                {getVirtueIcon(matchedChar.keyVirtue)} {matchedChar.keyVirtue}
              </div>
              <div style={styles.quizResultSummary}>{matchedChar.summary}</div>

              {/* 닉네임 입력/수정 */}
              <div style={styles.nicknameBox}>
                {editingNickname ? (
                  <div style={{ display: "flex", gap: "6px", width: "100%" }}>
                    <input
                      autoFocus
                      value={nicknameDraft}
                      onChange={(e) => setNicknameDraft(e.target.value)}
                      placeholder="닉네임 (최대 12자)"
                      maxLength={12}
                      style={styles.nicknameInput}
                    />
                    <button style={styles.nicknameSaveBtn} onClick={handleNicknameSave}>저장</button>
                  </div>
                ) : (
                  <button
                    style={styles.nicknameEdit}
                    onClick={() => {
                      setNicknameDraft(nickname);
                      setEditingNickname(true);
                    }}
                  >
                    {nickname ? `✏️ ${nickname}` : "✏️ 닉네임 설정하기"}
                  </button>
                )}
              </div>

              <div style={styles.quizResultButtons}>
                <button
                  style={styles.quizResultShareBtn}
                  onClick={() => shareMatchResult(matchedChar)}
                >
                  📤 공유하기
                </button>
                <button
                  style={styles.quizResultDetailBtn}
                  onClick={() => {
                    track.click("character_quiz_result_detail", {
                      character_id: matchedChar.id,
                      name: matchedChar.name,
                    });
                    setSelectedChar(matchedChar);
                  }}
                >
                  자세히 보기
                </button>
                <button
                  style={styles.quizResultRetryBtn}
                  onClick={() => {
                    track.click("character_quiz_retry");
                    resetQuiz();
                  }}
                >
                  다시 하기
                </button>
              </div>
              {shareNotice && <div style={styles.shareNotice}>{shareNotice}</div>}
            </div>
          )}
        </div>
      )}

      {/* 필터 */}
      <div style={styles.listHeader}>인물 목록</div>
      <div style={styles.filterRow}>
        {ERAS.map((era) => (
          <button
            key={era}
            onClick={() => {
              track.click("character_filter_change", { era });
              setFilter(era);
            }}
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
              onClick={() => {
                track.click("character_detail_open", {
                  character_id: char.id,
                  name: char.name,
                  era: char.era,
                  testament: char.testament,
                });
                setSelectedChar(char);
              }}
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
  container: { padding: "8px 16px 16px" },
  listHeader: { fontSize: "15px", fontWeight: 800, color: "#111827", marginTop: "24px", marginBottom: "12px" },
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
  // Quiz
  quizWrap: { marginBottom: "8px" },
  quizIntro: {
    padding: "28px 20px", borderRadius: "24px",
    background: "linear-gradient(135deg, #0D9488 0%, #6D28D9 100%)",
    color: "#FFFFFF", textAlign: "center" as const,
    boxShadow: "0 8px 24px rgba(13,148,136,0.25)",
  },
  quizSparkle: { fontSize: "36px", marginBottom: "8px" },
  quizTitle: { fontSize: "18px", fontWeight: 900, marginBottom: "6px", letterSpacing: "-0.5px" },
  quizDesc: { fontSize: "13px", color: "rgba(255,255,255,0.85)", marginBottom: "18px", lineHeight: "1.5" },
  quizStartBtn: {
    padding: "12px 28px", borderRadius: "100px",
    backgroundColor: "#FFFFFF", color: "#0D9488",
    fontSize: "14px", fontWeight: 800, border: "none", cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  },
  quizPlay: {
    padding: "20px", borderRadius: "24px",
    backgroundColor: "#FFFFFF",
    boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
  },
  quizProgressRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: "8px",
  },
  quizBackBtn: {
    width: "32px", height: "32px", borderRadius: "50%",
    border: "none", backgroundColor: "#F3F4F6",
    color: "#6B7280", fontSize: "16px", cursor: "pointer",
  },
  quizProgressText: { fontSize: "12px", fontWeight: 700, color: "#9CA3AF" },
  quizProgressBar: {
    width: "100%", height: "4px", borderRadius: "100px",
    backgroundColor: "#F3F4F6", overflow: "hidden", marginBottom: "20px",
  },
  quizProgressFill: {
    height: "100%", backgroundColor: "#0D9488",
    transition: "width 0.3s ease",
  },
  quizQuestion: {
    fontSize: "17px", fontWeight: 800, color: "#111827",
    marginBottom: "18px", lineHeight: "1.4", letterSpacing: "-0.3px",
  },
  quizOptions: { display: "flex", flexDirection: "column", gap: "10px" },
  quizOption: {
    padding: "14px 16px", borderRadius: "14px",
    backgroundColor: "#F9FAFB", color: "#1F2937",
    fontSize: "14px", fontWeight: 600, border: "1px solid #E5E7EB",
    cursor: "pointer", textAlign: "left" as const, lineHeight: "1.4",
    outline: "none", WebkitTapHighlightColor: "transparent",
  },
  quizOptionSelected: {
    padding: "14px 16px", borderRadius: "14px",
    backgroundColor: "#F0FDFA", color: "#0F766E",
    fontSize: "14px", fontWeight: 700, border: "1.5px solid #0D9488",
    cursor: "pointer", textAlign: "left" as const, lineHeight: "1.4",
    outline: "none", WebkitTapHighlightColor: "transparent",
  },
  quizAdButton: {
    marginTop: "16px", width: "100%",
    padding: "14px 16px", borderRadius: "100px",
    background: "linear-gradient(135deg, #0D9488 0%, #6D28D9 100%)",
    color: "#FFFFFF", fontSize: "14px", fontWeight: 800,
    border: "none", outline: "none",
    boxShadow: "0 4px 12px rgba(13,148,136,0.25)",
    WebkitTapHighlightColor: "transparent",
  },
  quizResult: {
    padding: "28px 20px", borderRadius: "24px",
    color: "#FFFFFF", textAlign: "center" as const,
    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
  },
  quizResultLabel: {
    fontSize: "12px", fontWeight: 700, letterSpacing: "2px",
    color: "rgba(255,255,255,0.8)", marginBottom: "12px",
  },
  quizResultImage: {
    width: "100px", height: "100px", borderRadius: "50%",
    objectFit: "cover" as const, margin: "0 auto 12px",
    border: "3px solid rgba(255,255,255,0.5)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
    display: "block",
  },
  quizResultName: { fontSize: "22px", fontWeight: 900, marginBottom: "4px" },
  quizResultTitle: { fontSize: "13px", color: "rgba(255,255,255,0.85)", marginBottom: "10px" },
  quizResultVirtue: {
    display: "inline-block",
    padding: "4px 14px", borderRadius: "100px",
    backgroundColor: "rgba(255,255,255,0.2)",
    fontSize: "12px", fontWeight: 700,
    marginBottom: "14px",
  },
  quizResultSummary: {
    fontSize: "13px", lineHeight: "1.6",
    color: "rgba(255,255,255,0.9)", marginBottom: "18px",
    textAlign: "left" as const,
    padding: "12px 14px", borderRadius: "12px",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  quizResultButtons: { display: "flex", gap: "8px" },
  quizResultDetailBtn: {
    flex: 1, padding: "12px", borderRadius: "100px",
    backgroundColor: "#FFFFFF", color: "#111827",
    fontSize: "13px", fontWeight: 800, border: "none", cursor: "pointer",
  },
  quizResultRetryBtn: {
    flex: 1, padding: "12px", borderRadius: "100px",
    backgroundColor: "rgba(255,255,255,0.18)", color: "#FFFFFF",
    fontSize: "13px", fontWeight: 800,
    border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer",
  },
  // Nickname / Share
  nicknameBox: {
    marginTop: "14px", marginBottom: "4px",
    display: "flex", justifyContent: "center",
  },
  nicknameEdit: {
    padding: "8px 16px", borderRadius: "100px",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#FFFFFF", fontSize: "13px", fontWeight: 700,
    border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer",
  },
  nicknameInput: {
    flex: 1, padding: "10px 14px", borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.5)",
    backgroundColor: "rgba(255,255,255,0.95)",
    fontSize: "14px", fontWeight: 600, color: "#111827",
  },
  nicknameSaveBtn: {
    padding: "10px 16px", borderRadius: "12px",
    backgroundColor: "#FFFFFF", color: "#0F766E",
    fontSize: "13px", fontWeight: 800, border: "none", cursor: "pointer",
  },
  quizResultShareBtn: {
    padding: "10px 20px", borderRadius: "100px",
    backgroundColor: "#FFFFFF", color: "#0F766E",
    fontSize: "14px", fontWeight: 800, border: "none", cursor: "pointer",
  },
  shareNotice: {
    marginTop: "10px", padding: "8px 12px", borderRadius: "10px",
    backgroundColor: "rgba(255,255,255,0.2)", color: "#FFFFFF",
    fontSize: "12px", fontWeight: 600,
  },
  // Last match banner
  lastMatchCard: {
    width: "100%", padding: "14px 16px", marginBottom: "14px",
    backgroundColor: "#FFFFFF", borderRadius: "18px",
    border: "1px solid #E6F4F1",
    boxShadow: "0 2px 10px rgba(13,148,136,0.08)",
    display: "flex", flexDirection: "column" as const, gap: "10px",
    textAlign: "left" as const,
  },
  lastMatchInner: {
    background: "transparent", border: "none", padding: 0,
    width: "100%", cursor: "pointer", textAlign: "left" as const,
  },
  lastMatchHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  lastMatchTag: { fontSize: "12px", fontWeight: 800, color: "#0D9488", letterSpacing: "0.3px" },
  lastMatchRow: { display: "flex", gap: "12px", alignItems: "center" },
  lastMatchActions: {
    display: "flex", gap: "8px", marginTop: "2px",
  },
  lastMatchShareBtn: {
    flex: 1, padding: "10px 12px", borderRadius: "12px",
    backgroundColor: "#0D9488", color: "#FFFFFF",
    fontSize: "13px", fontWeight: 800,
    border: "none", cursor: "pointer",
  },
  lastMatchDetailBtn: {
    flex: 1, padding: "10px 12px", borderRadius: "12px",
    backgroundColor: "#F0FDFA", color: "#0D9488",
    fontSize: "13px", fontWeight: 800,
    border: "1px solid #A7F3D0", cursor: "pointer",
  },
  lastMatchImage: {
    width: "56px", height: "56px", borderRadius: "50%",
    objectFit: "cover" as const, flexShrink: 0,
    border: "2px solid #F0FDFA",
  },
  lastMatchName: { fontSize: "15px", fontWeight: 800, color: "#111827", marginBottom: "4px" },
  lastMatchVerseRef: { fontSize: "11px", fontWeight: 800, color: "#0D9488", letterSpacing: "0.3px", marginBottom: "2px" },
  lastMatchVerseText: {
    fontSize: "13px", color: "#374151", lineHeight: 1.4,
    overflow: "hidden", display: "-webkit-box",
    WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
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
  sectionTitle: { fontSize: "13px", fontWeight: 700, color: "#9CA3AF", marginBottom: "8px", letterSpacing: "0.5px" },
  sectionContent: { fontSize: "15px", color: "#374151", lineHeight: "1.7" },
  eventList: {
    margin: 0, paddingLeft: "18px",
    fontSize: "14px", color: "#374151", lineHeight: "1.75",
  },
  eventItem: { marginBottom: "4px" },
  chipRow: { display: "flex", gap: "6px", flexWrap: "wrap" },
  strengthChip: {
    padding: "6px 12px", borderRadius: "100px",
    backgroundColor: "#F0FDFA", color: "#0F766E",
    fontSize: "12px", fontWeight: 700,
    border: "1px solid #CCFBF1",
  },
  extraVerse: {
    padding: "12px 14px", borderRadius: "12px",
    backgroundColor: "#F9FAFB", marginBottom: "8px",
    borderLeft: "3px solid #0D9488",
  },
  extraVerseText: {
    fontSize: "14px", color: "#374151", lineHeight: "1.6",
    marginBottom: "4px", fontStyle: "italic" as const,
  },
  extraVerseRef: { fontSize: "12px", color: "#6B7280", fontWeight: 600 },
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
