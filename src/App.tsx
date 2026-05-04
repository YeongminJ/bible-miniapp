import { useEffect, useState } from "react";
import { SafeAreaInsets, getSchemeUri } from "@apps-in-toss/web-framework";
import QuizTab from "./components/QuizTab";
import PrayerTab from "./components/PrayerTab";
import CharacterTab from "./components/CharacterTab";
import DailyVerse from "./components/DailyVerse";
import DailyHeader from "./components/DailyHeader";
import OnboardingSheet from "./components/OnboardingSheet";
import { hasOnboarded } from "./lib/onboarding";
import { UserProvider, useUser } from "./lib/UserContext";
import { track } from "./lib/analytics";

type Tab = "quiz" | "prayer" | "character";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "quiz", label: "퀴즈", icon: "📖" },
  { key: "prayer", label: "기도", icon: "🙏" },
  { key: "character", label: "인물", icon: "👤" },
];

const LAST_TAB_KEY = "lastActiveTab.v1";
const isTab = (v: unknown): v is Tab => v === "quiz" || v === "prayer" || v === "character";

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
  return null;
}

function AppContent() {
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => !hasOnboarded());
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

  useEffect(() => {
    track.screen(`tab_${activeTab}`, { tab: activeTab });
    try { localStorage.setItem(LAST_TAB_KEY, activeTab); } catch { /* ignore */ }
  }, [activeTab]);

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
    return <OnboardingSheet onDone={() => setShowOnboarding(false)} />;
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
