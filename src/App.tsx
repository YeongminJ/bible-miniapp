import { useEffect, useState } from "react";
import { SafeAreaInsets } from "@apps-in-toss/web-framework";
import QuizTab from "./components/QuizTab";
import PrayerTab from "./components/PrayerTab";
import CharacterTab from "./components/CharacterTab";

type Tab = "quiz" | "prayer" | "character";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "quiz", label: "퀴즈", icon: "📖" },
  { key: "prayer", label: "기도", icon: "🙏" },
  { key: "character", label: "인물", icon: "👤" },
];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("quiz");
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

  const topPad = Math.max(insets.top, 0);
  const bottomPad = Math.max(insets.bottom, 12);

  return (
    <div style={{ ...styles.app, paddingTop: topPad }}>
      {/* 콘텐츠 */}
      <div
        style={{
          ...styles.content,
          paddingBottom: `calc(70px + ${bottomPad}px)`,
        }}
      >
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
            onClick={() => setActiveTab(tab.key)}
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

export default App;
