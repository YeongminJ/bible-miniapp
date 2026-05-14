import { useEffect, useRef, useState } from "react";
import { tickStreak, reachedMilestone, type StreakState } from "../lib/streak";
import {
  MISSION_POOL,
  getMissionDef,
  getMissions,
  invokeMissionAction,
  isAllMissionsDone,
  missionsDoneCount,
  rerollMissions,
  type MissionsState,
} from "../lib/missions";
import { loadNotifySettings, type NotifySettings } from "../lib/notify-settings";
import { track } from "../lib/analytics";
import {
  describeGrantError,
  grantDailyMissionReward,
  isPromotionConfigured,
} from "../lib/promotion";
import {
  CLAIM_THRESHOLD,
  applyClaim,
  earnPointForToday,
  getPointsState,
  isClaimable,
  isEarnedToday,
  resetDailyEarn,
  rollDailyReward,
  type PointsState,
} from "../lib/points";
import { showInterstitialAd } from "../lib/ad";
import NotifySettingsModal from "./NotifySettingsModal";

const TOTAL = 3;

export default function DailyHeader() {
  const [streak, setStreak] = useState<StreakState>(() => ({ count: 0, lastDate: "", longest: 0 }));
  const [missions, setMissions] = useState<MissionsState>(() => getMissions());
  const [notify, setNotify] = useState<NotifySettings>(() => loadNotifySettings());
  const [points, setPoints] = useState<PointsState>(() => getPointsState());
  const [open, setOpen] = useState(false);
  // 미션 버튼 두근두근 효과 — 진입 시 미완료 미션이 있으면 활성. 사용자가 처음 탭하면 꺼짐.
  const [pulseMission, setPulseMission] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimPhase, setClaimPhase] = useState<"ad" | "grant" | null>(null);
  const [earning, setEarning] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // 디버그용 — 🔥 스트릭 칩 빠르게 7번 탭하면 localStorage 초기화. 1.5s 안에 7번 안 누르면 카운트 리셋.
  const debugTapCountRef = useRef(0);
  const debugTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleStreakChipTap = () => {
    debugTapCountRef.current += 1;
    if (debugTapTimerRef.current) clearTimeout(debugTapTimerRef.current);
    debugTapTimerRef.current = setTimeout(() => { debugTapCountRef.current = 0; }, 1500);
    if (debugTapCountRef.current >= 7) {
      debugTapCountRef.current = 0;
      if (window.confirm("앱 데이터를 초기화할까요? (디버그용)")) {
        try { localStorage.clear(); } catch { /* ignore */ }
        window.location.reload();
      }
    }
  };

  // 자동 펼침/접힘 제어용
  const autoShowRef = useRef(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tick = tickStreak();
    setStreak(tick.state);
    // 스트릭 변화 트래킹 — 리텐션 분석용
    if (tick.kind === "extended") {
      track.click("streak_extended", {
        count: tick.state.count,
        previous_count: tick.previousCount,
        longest: tick.state.longest,
      });
      const ms = reachedMilestone(tick.state.count);
      if (ms != null) {
        track.click("streak_milestone", {
          milestone: ms,
          longest: tick.state.longest,
        });
      }
    } else if (tick.kind === "broken") {
      track.click("streak_broken", {
        previous_count: tick.previousCount,
        longest: tick.state.longest,
      });
    } else if (tick.kind === "first_day") {
      track.click("streak_first_day");
    }
    const refreshMissions = () => setMissions(getMissions());
    const refreshNotify = () => setNotify(loadNotifySettings());
    const refreshPoints = () => setPoints(getPointsState());
    refreshMissions();
    refreshPoints();
    window.addEventListener("missions:changed", refreshMissions);
    window.addEventListener("notifySettings:changed", refreshNotify);
    window.addEventListener("points:changed", refreshPoints);
    return () => {
      window.removeEventListener("missions:changed", refreshMissions);
      window.removeEventListener("notifySettings:changed", refreshNotify);
      window.removeEventListener("points:changed", refreshPoints);
    };
  }, []);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && e.target instanceof Node && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        autoShowRef.current = false;
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // 펄스 효과 트리거: 마운트 + 백그라운드 복귀.
  // 이전엔 패널을 자동으로 펼쳤지만, 사용자가 클릭해서 열도록 두근두근만 유도.
  useEffect(() => {
    const triggerPulse = (trigger: "mount" | "visibility") => {
      setPulseMission(true);
      track.screen("daily_missions_auto_show", { trigger, mode: "pulse" });
    };
    triggerPulse("mount");
    const onVis = () => {
      if (document.visibilityState === "visible") triggerPulse("visibility");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
  }, []);

  const done = missionsDoneCount(missions);
  const allDone = isAllMissionsDone(missions);
  const earnedToday = isEarnedToday(points);

  const showFeedback = (f: { type: "ok" | "err"; text: string }, ms = 3500) => {
    setFeedback(f);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), ms);
  };

  // ── "말씀 포인트 받기" — 광고 시청 후 가중 랜덤 적립 ─────
  const handleEarn = async () => {
    if (!allDone || earnedToday || earning) return;
    setEarning(true);
    track.click("daily_points_earn_attempt");
    try {
      const adResult = await showInterstitialAd();
      track.impression("daily_points_earn_ad_result", {
        shown: adResult.shown,
        reason: adResult.shown ? "dismissed" : adResult.reason,
      });
      // 광고가 뜨지 않은 환경(미지원/네트워크 실패 등)에서도 사용자가 미션을 완료했으니 적립은 진행.
      const amount = rollDailyReward();
      const r = earnPointForToday(amount);
      if (r.earned) {
        track.click("daily_points_earned", {
          amount,
          balance: r.state.balance,
          ad_shown: adResult.shown,
        });
        showFeedback({ type: "ok", text: `🎁 오늘의 말씀 포인트 ${amount}원 적립!` });
      } else {
        showFeedback({ type: "ok", text: "오늘은 이미 받았어요. 내일 다시 만나요." });
      }
    } finally {
      setEarning(false);
    }
  };

  // ── 누적 잔액 수령 (토스 프로모션) ─────
  const claimable = isClaimable(points);
  const remainingToThreshold = Math.max(0, CLAIM_THRESHOLD - points.balance);

  // ── 누적 잔액 수령 — 광고 시청 후 토스 프로모션 호출 ─────
  const handleClaim = async () => {
    if (!claimable || claiming) return;
    const amount = points.balance;
    if (amount <= 0) return;

    setClaiming(true);
    setClaimPhase("ad");
    track.click("daily_points_claim_attempt", { amount });
    try {
      // 1) 광고 시청 게이트 (미지원 환경에서는 graceful fallback — 사용자 unblock)
      const adResult = await showInterstitialAd();
      track.impression("daily_points_claim_ad_result", {
        shown: adResult.shown,
        reason: adResult.shown ? "dismissed" : adResult.reason,
      });

      // 2) 광고가 끝났으면 실제 토스 프로모션 지급 호출
      setClaimPhase("grant");
      const result = await grantDailyMissionReward(amount);
      if (result.ok) {
        const next = applyClaim(amount);
        setPoints(next);
        track.click("daily_points_claim_success", {
          amount,
          claimed_total: next.claimedTotal,
          key: result.key,
          ad_shown: adResult.shown,
        });
        showFeedback({ type: "ok", text: `${amount}원 지급 완료! 누적 ${next.claimedTotal}원` });
      } else {
        if (result.code === "4113") {
          const next = applyClaim(amount);
          setPoints(next);
          showFeedback({ type: "ok", text: "이미 지급된 포인트로 처리됐어요." });
        } else {
          showFeedback({ type: "err", text: describeGrantError(result.code, result.message) });
        }
        track.click("daily_points_claim_error", {
          code: result.code,
          message: result.message ?? "",
          ad_shown: adResult.shown,
        });
      }
    } finally {
      setClaiming(false);
      setClaimPhase(null);
    }
  };

  // 미션 리롤 — 완료 상태 + 오늘 적립 기록까지 초기화. 새 3개를 완료하면 다시 받을 수 있다.
  const handleReroll = () => {
    track.click("daily_missions_reroll", {
      previous_active: missions.active.join(","),
      had_earned_today: earnedToday,
    });
    const nextMissions = rerollMissions();
    setMissions(nextMissions);
    const nextPoints = resetDailyEarn();
    setPoints(nextPoints);
    showFeedback({ type: "ok", text: "새로운 미션 3개를 가져왔어요. 다시 도전해 보세요!" }, 2200);
  };

  let claimBtnLabel: string;
  let claimBtnEmoji: string | null = null;
  let claimBtnState: "ready" | "locked" | "loading";
  if (claiming) {
    claimBtnState = "loading";
    claimBtnLabel = claimPhase === "ad" ? "광고 준비 중…" : "지급 중…";
  } else if (claimable) {
    claimBtnState = "ready";
    claimBtnLabel = `광고 보고 ${points.balance}원 받기`;
    claimBtnEmoji = "🎁";
  } else {
    claimBtnState = "locked";
    claimBtnLabel = `${remainingToThreshold}원 더 모으면 받을 수 있어요`;
  }

  return (
    <div ref={wrapRef} style={styles.wrap}>
      <div style={styles.row}>
        <div
          style={{ ...styles.streakChip, ...(streak.count >= 7 ? styles.streakChipHot : {}) }}
          onClick={handleStreakChipTap}
        >
          <span style={styles.streakIcon}>🔥</span>
          <span style={styles.streakNum}>{streak.count}</span>
          <span style={styles.streakUnit}>일 연속</span>
        </div>
        <button
          style={{ ...styles.notifyBtn, ...(notify.enabled ? styles.notifyBtnOn : {}) }}
          onClick={() => {
            setNotifyOpen(true);
            track.click("notify_settings_open", { enabled: notify.enabled });
          }}
          aria-label="알림 설정"
        >
          🔔
          {notify.enabled && <span style={styles.notifyDot} />}
        </button>
        <button
          style={{
            ...styles.missionBtn,
            ...(allDone ? styles.missionBtnDone : {}),
            ...(pulseMission && !allDone ? styles.missionBtnPulse : {}),
          }}
          onClick={() => {
            const next = !open;
            setOpen(next);
            autoShowRef.current = false;
            setPulseMission(false);
            track.click("daily_missions_toggle", { expanded: next });
          }}
          aria-expanded={open}
          aria-label={`오늘의 미션 ${done}/${TOTAL} 완료`}
        >
          <span style={styles.missionLabel}>오늘의 미션</span>
          <span style={styles.missionCount}>{done}/{TOTAL}</span>
          <span style={styles.missionCaret}>{open ? "▴" : "▾"}</span>
        </button>
      </div>

      <NotifySettingsModal open={notifyOpen} onClose={() => setNotifyOpen(false)} />
      {open && (
        <div style={styles.panel}>
          {missions.active.map((id) => {
            const def = getMissionDef(id);
            if (!def) return null;
            const ok = missions.done[id] === true;
            const handleItemClick = () => {
              if (ok) return;
              track.click("daily_missions_item_invoke", { id });
              invokeMissionAction(id);
              setOpen(false);
              autoShowRef.current = false;
            };
            return (
              <button
                key={id}
                type="button"
                onClick={handleItemClick}
                disabled={ok}
                style={{
                  ...styles.item,
                  ...(ok ? styles.itemDone : styles.itemActionable),
                }}
                aria-label={ok ? `${def.title} 완료` : `${def.title} - ${def.cta}`}
              >
                <span style={styles.itemIcon}>{def.icon}</span>
                <div style={styles.itemBody}>
                  <div style={styles.itemTitle}>{def.title}</div>
                  <div style={styles.itemDesc}>{def.desc}</div>
                </div>
                <span style={{ ...styles.itemStatus, ...(ok ? styles.itemStatusDone : styles.itemStatusCta) }}>
                  {ok ? "✓ 완료" : def.cta}
                </span>
              </button>
            );
          })}

          {/* 미션 추가로 수행하기 — 풀에서 새로운 3개 가져오기 */}
          <button style={styles.rerollBtn} onClick={handleReroll}>
            <span style={styles.rerollIcon}>🔄</span>
            <span>미션 추가로 수행하기</span>
            <span style={styles.rerollHint}>{MISSION_POOL.length}개 중 랜덤</span>
          </button>

          {/* 적립 + 수령 영역 (프로모션 코드 설정된 경우만) */}
          {isPromotionConfigured() && (
            <div style={styles.claimWrap}>
              {/* 1단계: 말씀 포인트 받기 (광고 시청 → 1~5원 랜덤 적립) */}
              {!earnedToday ? (
                <button
                  style={{
                    ...styles.earnBtn,
                    ...(allDone && !earning ? styles.earnBtnReady : styles.earnBtnLocked),
                    ...(earning ? styles.earnBtnLoading : {}),
                  }}
                  onClick={handleEarn}
                  disabled={!allDone || earning}
                  aria-label={
                    allDone
                      ? "광고 보고 오늘의 말씀 포인트 받기"
                      : "미션 3개를 모두 완료해 주세요"
                  }
                >
                  {earning ? (
                    <>
                      <span style={styles.claimSpinner} aria-hidden />
                      <span>광고 준비 중…</span>
                    </>
                  ) : (
                    <>
                      <span style={styles.earnEmoji}>🎁</span>
                      <span style={styles.earnTextWrap}>
                        <span style={styles.earnTitle}>
                          {allDone ? "말씀 포인트 받기" : "미션을 모두 완료해 주세요"}
                        </span>
                        <span style={styles.earnSub}>
                          광고 보면 1~5원 랜덤으로 적립돼요
                        </span>
                      </span>
                    </>
                  )}
                </button>
              ) : (
                <div style={styles.earnDoneBadge}>
                  <span style={styles.earnEmoji}>✅</span>
                  <span>
                    오늘 {points.lastEarnedAmount ?? 0}원 받았어요 · 내일 다시 만나요
                  </span>
                </div>
              )}

              {/* 잔액 / 누적 수령 표시 */}
              <div style={styles.pointsRow}>
                <div style={styles.pointsCell}>
                  <div style={styles.pointsCellLabel}>쌓인 포인트</div>
                  <div style={styles.pointsCellValue}>
                    <span style={styles.pointsCellAmount}>{points.balance}</span>
                    <span style={styles.pointsCellUnit}>원</span>
                  </div>
                </div>
                <div style={styles.pointsDivider} />
                <div style={styles.pointsCell}>
                  <div style={styles.pointsCellLabel}>지금까지 받은</div>
                  <div style={styles.pointsCellValue}>
                    <span style={styles.pointsCellAmount}>{points.claimedTotal}</span>
                    <span style={styles.pointsCellUnit}>원</span>
                  </div>
                </div>
              </div>

              {/* 진행 게이지 */}
              {!claimable && (
                <div style={styles.progressWrap} aria-hidden>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${Math.min(100, (points.balance / CLAIM_THRESHOLD) * 100)}%`,
                    }}
                  />
                </div>
              )}

              {/* 2단계: 수령 버튼 (잔액 ≥ 10원) */}
              <button
                style={{
                  ...styles.claimBtn,
                  ...(claimBtnState === "ready" ? styles.claimBtnReady : {}),
                  ...(claimBtnState === "locked" ? styles.claimBtnLocked : {}),
                  ...(claimBtnState === "loading" ? styles.claimBtnLoading : {}),
                }}
                onClick={handleClaim}
                disabled={claimBtnState !== "ready"}
                aria-label={
                  claimBtnState === "ready"
                    ? `광고 보고 ${points.balance}원 받기`
                    : `${remainingToThreshold}원 더 모으면 받을 수 있어요`
                }
              >
                {claimBtnState === "loading" && (
                  <span style={styles.claimSpinner} aria-hidden />
                )}
                <span style={styles.claimText}>{claimBtnLabel}</span>
                {claimBtnEmoji && <span style={styles.claimEmoji}>{claimBtnEmoji}</span>}
              </button>

              {feedback && (
                <div
                  style={{
                    ...styles.feedback,
                    ...(feedback.type === "ok" ? styles.feedbackOk : styles.feedbackErr),
                  }}
                  role="status"
                >
                  {feedback.text}
                </div>
              )}

              <div style={styles.hint}>
                매일 미션 3개를 모두 완료하고 광고를 보면 1~5원이 쌓여요. {CLAIM_THRESHOLD}원부터 받기 가능해요.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { padding: "8px 16px 0", position: "relative" as const },
  row: { display: "flex", alignItems: "center", gap: "8px" },
  streakChip: {
    display: "flex", alignItems: "center", gap: "4px",
    padding: "5px 10px", borderRadius: "100px",
    backgroundColor: "#FFFBEB", color: "#92400E",
    border: "1px solid #FDE68A",
    fontSize: "12px", fontWeight: 800, lineHeight: 1,
  },
  streakChipHot: {
    backgroundColor: "#FEF2F2", color: "#9F1239",
    border: "1px solid #FECACA",
  },
  streakIcon: { fontSize: "13px" },
  streakNum: { fontSize: "13px", fontWeight: 900 },
  streakUnit: { fontSize: "11px", fontWeight: 700, opacity: 0.85 },
  notifyBtn: {
    marginLeft: "auto",
    width: "32px", height: "26px",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    padding: 0, borderRadius: "100px",
    backgroundColor: "#F3F4F6", color: "#374151",
    border: "1px solid #E5E7EB", cursor: "pointer",
    fontSize: "14px", lineHeight: 1, position: "relative" as const,
  },
  notifyBtnOn: {
    backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0",
  },
  notifyDot: {
    position: "absolute" as const, top: "-2px", right: "-2px",
    width: "8px", height: "8px", borderRadius: "50%",
    backgroundColor: "#10B981", border: "2px solid #FFFFFF",
  },
  missionBtn: {
    display: "flex", alignItems: "center", gap: "6px",
    padding: "5px 10px", borderRadius: "100px",
    backgroundColor: "#F3F4F6", color: "#374151",
    border: "1px solid #E5E7EB", cursor: "pointer",
    fontSize: "12px", fontWeight: 800, lineHeight: 1,
  },
  missionBtnDone: {
    backgroundColor: "#ECFDF5", color: "#065F46",
    border: "1px solid #A7F3D0",
  },
  missionBtnPulse: {
    backgroundColor: "#FEF3C7", color: "#92400E",
    border: "1px solid #FDE68A",
    animation: "qt-heartbeat 1.4s ease-in-out infinite",
  },
  missionLabel: { fontSize: "12px", fontWeight: 800 },
  missionCount: {
    fontSize: "11px", fontWeight: 900,
    backgroundColor: "rgba(255,255,255,0.7)",
    padding: "2px 6px", borderRadius: "100px",
  },
  missionCaret: { fontSize: "10px", marginLeft: "-2px" },
  panel: {
    marginTop: "6px",
    backgroundColor: "#FFFFFF",
    borderRadius: "14px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
    border: "1px solid #E5E7EB",
    padding: "8px",
    display: "flex", flexDirection: "column" as const, gap: "2px",
  },
  item: {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "10px 12px", borderRadius: "10px",
    width: "100%",
    border: "none",
    background: "transparent",
    textAlign: "left" as const,
    cursor: "pointer",
  },
  itemActionable: { cursor: "pointer" },
  itemDone: { cursor: "default", opacity: 0.78 },
  itemIcon: { fontSize: "20px", lineHeight: 1, flexShrink: 0 },
  itemBody: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: "14px", fontWeight: 800, color: "#111827", marginBottom: "2px" },
  itemDesc: { fontSize: "12px", color: "#6B7280", lineHeight: 1.4 },
  itemStatus: {
    fontSize: "11px", fontWeight: 800, color: "#9CA3AF",
    backgroundColor: "#F3F4F6",
    padding: "4px 10px", borderRadius: "100px",
    flexShrink: 0,
  },
  itemStatusDone: { color: "#065F46", backgroundColor: "#ECFDF5" },
  itemStatusCta: {
    color: "#0D9488",
    backgroundColor: "#F0FDFA",
    border: "1px solid #A7F3D0",
  },
  rerollBtn: {
    marginTop: "6px",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
    padding: "10px 12px",
    borderRadius: "10px",
    backgroundColor: "#F3F4F6",
    color: "#4B5563",
    border: "1px dashed #D1D5DB",
    fontSize: "13px", fontWeight: 700,
    cursor: "pointer",
  },
  rerollIcon: { fontSize: "14px" },
  rerollHint: {
    fontSize: "11px", color: "#9CA3AF", fontWeight: 600, marginLeft: "4px",
  },
  claimWrap: {
    marginTop: "8px",
    padding: "10px 4px 4px",
    display: "flex", flexDirection: "column" as const, gap: "10px",
    borderTop: "1px dashed #E5E7EB",
  },
  // 말씀 포인트 받기 (광고 시청 → 적립)
  earnBtn: {
    width: "100%",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "none",
    fontSize: "14px", fontWeight: 800, lineHeight: 1.2,
    cursor: "pointer",
    transition: "transform 120ms ease, opacity 120ms ease",
  },
  earnBtnReady: {
    backgroundColor: "#F59E0B",
    color: "#FFFFFF",
    boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)",
  },
  earnBtnLocked: {
    backgroundColor: "#F3F4F6",
    color: "#9CA3AF",
    cursor: "not-allowed",
    border: "1px solid #E5E7EB",
  },
  earnBtnLoading: { opacity: 0.85, cursor: "progress" },
  earnEmoji: { fontSize: "20px" },
  earnTextWrap: {
    display: "flex", flexDirection: "column" as const, alignItems: "flex-start",
    gap: "2px",
  },
  earnTitle: { fontSize: "14px", fontWeight: 900 },
  earnSub: { fontSize: "11px", fontWeight: 600, opacity: 0.92 },
  earnDoneBadge: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
    padding: "12px 14px",
    borderRadius: "12px",
    backgroundColor: "#FFFBEB",
    color: "#92400E",
    border: "1px solid #FDE68A",
    fontSize: "13px", fontWeight: 800,
  },
  pointsRow: {
    display: "flex", alignItems: "stretch",
    backgroundColor: "#FFFBEB",
    border: "1px solid #FDE68A",
    borderRadius: "12px",
    padding: "10px 8px",
  },
  pointsCell: {
    flex: 1,
    display: "flex", flexDirection: "column" as const,
    alignItems: "center", gap: "4px",
  },
  pointsCellLabel: {
    fontSize: "11px", fontWeight: 800, color: "#92400E",
    letterSpacing: "0.2px",
  },
  pointsCellValue: {
    display: "flex", alignItems: "baseline", gap: "2px",
    color: "#92400E",
  },
  pointsCellAmount: { fontSize: "18px", fontWeight: 900 },
  pointsCellUnit: { fontSize: "12px", fontWeight: 800 },
  pointsDivider: {
    width: "1px",
    backgroundColor: "rgba(146, 64, 14, 0.18)",
    margin: "4px 6px",
  },
  progressWrap: {
    height: "6px", borderRadius: "100px",
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#0D9488",
    transition: "width 0.3s ease",
  },
  claimBtn: {
    width: "100%",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1px solid transparent",
    fontSize: "14px", fontWeight: 800, lineHeight: 1.2,
    cursor: "pointer",
    transition: "transform 120ms ease, opacity 120ms ease",
  },
  claimBtnLocked: {
    backgroundColor: "#F3F4F6",
    color: "#9CA3AF",
    border: "1px solid #E5E7EB",
    cursor: "not-allowed",
  },
  claimBtnReady: {
    backgroundColor: "#0D9488",
    color: "#FFFFFF",
    border: "1px solid #0D9488",
    boxShadow: "0 4px 12px rgba(13, 148, 136, 0.25)",
  },
  claimBtnLoading: {
    backgroundColor: "#0D9488",
    color: "#FFFFFF",
    opacity: 0.85,
    cursor: "progress",
  },
  claimSpinner: {
    width: "14px", height: "14px",
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.4)",
    borderTopColor: "#FFFFFF",
    animation: "dh-spin 0.8s linear infinite",
  },
  claimText: { whiteSpace: "nowrap" as const },
  claimEmoji: { fontSize: "15px" },
  feedback: {
    fontSize: "12px", fontWeight: 700,
    padding: "8px 10px",
    borderRadius: "10px",
    textAlign: "center" as const,
  },
  feedbackOk: {
    color: "#065F46",
    backgroundColor: "#ECFDF5",
    border: "1px solid #A7F3D0",
  },
  feedbackErr: {
    color: "#991B1B",
    backgroundColor: "#FEF2F2",
    border: "1px solid #FECACA",
  },
  hint: {
    fontSize: "11px", color: "#9CA3AF", textAlign: "center" as const,
    lineHeight: 1.5,
  },
};
