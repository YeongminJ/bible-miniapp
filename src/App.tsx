import { useEffect, useRef, useState } from "react";
import { SafeAreaInsets, getSchemeUri } from "@apps-in-toss/web-framework";
import QuizTab from "./components/QuizTab";
import PrayerTab from "./components/PrayerTab";
import CharacterTab from "./components/CharacterTab";
import BibleReadingTab from "./components/BibleReadingTab";
import DailyVerse from "./components/DailyVerse";
import DailyHeader from "./components/DailyHeader";
import OnboardingSheet from "./components/OnboardingSheet";
import { hasOnboarded, resetOnboarded, getOnboardedAt } from "./lib/onboarding";
import { UserProvider, useUser } from "./lib/UserContext";
import { track } from "./lib/analytics";
import {
  isMappingVerified,
  wasMappingEverVerified,
  rememberAnonHash,
  getLastAnonHash,
} from "./lib/mapping-cache";
import { checkMappingStatus, ensureUserName } from "./lib/notify-api";
import { loadNotifySettings } from "./lib/notify-settings";
import { ensureUserKey } from "./lib/user-key";

type Tab = "quiz" | "prayer" | "character" | "bible";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "quiz", label: "퀴즈", icon: "🎯" },
  { key: "prayer", label: "기도", icon: "🙏" },
  { key: "character", label: "인물", icon: "👤" },
  { key: "bible", label: "통독", icon: "📖" },
];

const LAST_TAB_KEY = "lastActiveTab.v1";
const isTab = (v: unknown): v is Tab =>
  v === "quiz" || v === "prayer" || v === "character" || v === "bible";

// 앱인토스 콘솔의 "앱 내 기능" 진입 스킴 또는 브라우저 URL을 해석해 초기 탭 결정
// 지원 형식:
//   - intoss-private://bible-mini/quiz | /prayer | /character
//   - intoss-private://bible-mini?tab=quiz
//   - https://.../app?tab=prayer
function getInitialTabFromScheme(): Tab | null {
  let raw = "";
  try { raw = (getSchemeUri?.() ?? "") as string; } catch { /* ignore */ }
  if (!raw && typeof window !== "undefined") raw = window.location.href ?? "";
  if (!raw) return null;

  // 1) 쿼리 ?tab=
  const qIdx = raw.indexOf("?");
  if (qIdx >= 0) {
    try {
      const qs = new URLSearchParams(raw.slice(qIdx + 1));
      const t = qs.get("tab");
      if (isTab(t)) return t;
    } catch { /* ignore */ }
  }

  // 2) path segment
  const lower = raw.toLowerCase();
  if (/\/(quiz|q)(?=$|[/?#])/i.test(lower)) return "quiz";
  if (/\/(prayer|p)(?=$|[/?#])/i.test(lower)) return "prayer";
  if (/\/(character|c|people|person)(?=$|[/?#])/i.test(lower)) return "character";
  if (/\/(bible|b|read|reading)(?=$|[/?#])/i.test(lower)) return "bible";
  return null;
}

function AppContent() {
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => !hasOnboarded());
  const [onboardingMode, setOnboardingMode] = useState<"fresh" | "recovery">(() =>
    hasOnboarded() ? "recovery" : "fresh",
  );
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const fromScheme = getInitialTabFromScheme();
    if (fromScheme) return fromScheme;
    try {
      const saved = localStorage.getItem(LAST_TAB_KEY);
      if (isTab(saved)) return saved;
    } catch { /* ignore */ }
    return "quiz";
  });
  const { loading } = useUser();
  const [insets, setInsets] = useState(() => {
    try { return SafeAreaInsets.get(); }
    catch { return { top: 0, bottom: 0, left: 0, right: 0 }; }
  });

  useEffect(() => {
    try {
      const cleanup = SafeAreaInsets.subscribe({ onEvent: setInsets });
      return cleanup;
    } catch { /* unsupported env */ }
  }, []);

  useEffect(() => {
    track.screen("app_open");
  }, []);

  // 표시 이름 동기화 (공유 메시지에 "{이름}님" prefix 용도).
  // 매핑된 사용자만 의미 있고, 캐시 히트면 네트워크 호출 없이 즉시 반환.
  // 부수적으로 anonHash를 캐시해 두면 다음에 recovery가 트리거됐을 때 진단이 가능해진다.
  useEffect(() => {
    void (async () => {
      const hash = await ensureUserKey();
      if (!hash) return;
      rememberAnonHash(hash);
      await ensureUserName(hash);
    })();
  }, []);

  useEffect(() => {
    track.screen(`tab_${activeTab}`, { tab: activeTab });
    try { localStorage.setItem(LAST_TAB_KEY, activeTab); } catch { /* ignore */ }
  }, [activeTab]);

  // 미션 액션: 각 미션 id에 따라 적절한 탭으로 이동.
  //  - verse: 탭 변경 불필요 (헤더 위 카드, DailyVerse가 자체 listen해서 expand+TTS)
  //  - quiz: 퀴즈 탭으로 이동, QuizTab이 listen해서 '쉬움' 버튼 두근두근
  //  - prayer: 기도 탭
  //  - gratitude: 기도 탭(감사일기 섹션이 거기 있음), GratitudeJournal이 listen해서 작성 모달 열기
  //  - character: 인물 탭
  useEffect(() => {
    const onInvoke = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id?: string } | null;
      const id = detail?.id;
      if (id === "quiz") setActiveTab("quiz");
      else if (id === "prayer" || id === "gratitude") setActiveTab("prayer");
      else if (id === "character") setActiveTab("character");
    };
    window.addEventListener("mission:invoke", onInvoke);
    return () => window.removeEventListener("mission:invoke", onInvoke);
  }, []);

  // OAuth 매핑 깨진 케이스 자동 복구.
  //  - 정상 유저(이전에 isMapped 확인된 적 있음)는 localStorage 플래그로 즉시 skip → 네트워크 호출 0
  //  - 플래그 없고, 알림 ON 상태이며, 서버가 명확히 "미매핑" 응답을 주면 onboarded 플래그 리셋
  //    → OnboardingSheet 다시 띄움(recovery 모드) → 사용자가 "시작하기" 누르면 ensureMapped 재시도
  //
  // 중요: 한 세션에 한 번만 체크한다(ref 가드).
  // 이게 없으면 사용자가 recovery onboarding을 끝낸 직후 useEffect가 재실행되어
  // 아직 ensureMapped(appLogin)이 진행 중인 동안 verified 플래그가 없다는 이유로
  // 다시 onboarded를 reset → 온보딩이 또 뜨는 무한 루프 발생.
  const recoveryCheckedRef = useRef(false);
  useEffect(() => {
    if (recoveryCheckedRef.current) return;
    if (showOnboarding) return; // 이미 온보딩 중(첫 진입 fresh 모드 등)
    if (!hasOnboarded()) return;
    if (isMappingVerified()) return;
    recoveryCheckedRef.current = true; // 중복 트리거 방지
    let cancelled = false;
    void (async () => {
      const notify = loadNotifySettings();
      if (!notify.enabled) return; // 알림 끈 상태면 복구 불필요
      const hash = await ensureUserKey();
      if (!hash || cancelled) return;
      const { isMapped, ok } = await checkMappingStatus(hash);
      if (cancelled) return;
      if (ok && !isMapped) {
        // 진단: 왜 recovery가 발생했는지 4가지 케이스로 분류
        //  1) anon_key_changed       — 이전에 캐시된 hash와 다름 → 재설치/디바이스 변경 가능성
        //  2) mapping_lost_after_verified — 과거에 verified 됐는데 서버에서 사라짐 (가장 심각)
        //  3) mapping_never_verified — onboarded 됐지만 verified 도달 못한 채로 흘러옴
        //  4) no_prior_anon_cache    — 캐시 자체가 없음 (앱 첫 진입 후 곧바로 recovery)
        const lastHash = getLastAnonHash();
        const anonKeyMatch = lastHash != null && lastHash === hash;
        const everVerified = wasMappingEverVerified();
        const onboardedAt = getOnboardedAt();
        const daysSinceOnboarding =
          onboardedAt != null
            ? Math.floor((Date.now() - onboardedAt) / 86400000)
            : null;
        const reason: string =
          lastHash == null
            ? "no_prior_anon_cache"
            : !anonKeyMatch
              ? "anon_key_changed"
              : everVerified
                ? "mapping_lost_after_verified"
                : "mapping_never_verified";
        track.screen("onboarding_recovery_trigger", {
          reason,
          ever_verified: everVerified,
          anon_key_match: anonKeyMatch,
          had_prior_anon_cache: lastHash != null,
          days_since_onboarding: daysSinceOnboarding,
        });
        resetOnboarded();
        setOnboardingMode("recovery");
        setShowOnboarding(true);
      }
      // hash가 새로 잡혔으면 다음 세션 진단을 위해 캐시
      rememberAnonHash(hash);
      // ok && isMapped인 경우 checkMappingStatus 내부에서 markMappingVerified 호출됨
      // ok=false는 네트워크/서버 오류이므로 절대 reset하지 않음
    })();
    return () => { cancelled = true; };
  }, [showOnboarding]);

  const topPad = Math.max(insets.top, 0);
  const bottomPad = Math.max(insets.bottom, 12);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", backgroundColor: "#F6F6F9" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>📖</div>
          <div style={{ fontSize: "14px", color: "#9CA3AF", fontWeight: 600 }}>불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <OnboardingSheet
        mode={onboardingMode}
        onDone={() => {
          setShowOnboarding(false);
          setOnboardingMode("fresh");
        }}
      />
    );
  }

  return (
    <div style={{ ...styles.app, paddingTop: topPad }}>
      {/* 콘텐츠 */}
      <div
        style={{
          ...styles.content,
          paddingBottom: `calc(70px + ${bottomPad}px)`,
        }}
      >
        <DailyHeader />
        <DailyVerse />
        {activeTab === "quiz" && <QuizTab />}
        {activeTab === "prayer" && <PrayerTab />}
        {activeTab === "character" && <CharacterTab />}
        {activeTab === "bible" && <BibleReadingTab />}
      </div>

      {/* 하단 탭바 */}
      <div style={{ ...styles.tabBar, paddingBottom: bottomPad }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            style={{
              ...styles.tab,
              color: activeTab === tab.key ? "#0D9488" : "#9CA3AF",
            }}
            onClick={() => {
              track.click("tab_change", { from: activeTab, to: tab.key });
              setActiveTab(tab.key);
            }}
          >
            <span style={{ fontSize: "24px" }}>{tab.icon}</span>
            <span style={{
              fontSize: "11px",
              fontWeight: activeTab === tab.key ? 800 : 600,
              letterSpacing: "0.5px",
            }}>
              {tab.label}
            </span>
            {activeTab === tab.key && <div style={styles.indicator} />}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    height: "100dvh",
    backgroundColor: "#F6F6F9",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  },
  tabBar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "space-around",
    backgroundColor: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(20px)",
    borderTop: "1px solid #F3F4F6",
    paddingTop: "8px",
    zIndex: 100,
  },
  tab: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    padding: "4px 24px",
    border: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    position: "relative",
  },
  indicator: {
    position: "absolute",
    top: "-8px",
    width: "20px",
    height: "3px",
    borderRadius: "2px",
    backgroundColor: "#0D9488",
  },
};

function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}

export default App;
