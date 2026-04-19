import { useState } from "react";
import { Top } from "@toss/tds-mobile";
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

  return (
    <div style={styles.app}>
      <Top
        title={
          <Top.TitleParagraph size={22}>
            <span style={{ fontWeight: 900, letterSpacing: "-1px" }}>오늘의 은혜</span>
          </Top.TitleParagraph>
        }
        subtitleBottom={
          <Top.SubtitleParagraph size={14}>
            {activeTab === "quiz" && "성경 퀴즈로 말씀을 즐겨보세요"}
            {activeTab === "prayer" && "상황에 맞는 기도문을 읽어보세요"}
            {activeTab === "character" && "성경 인물을 만나보세요"}
          </Top.SubtitleParagraph>
        }
      />

      {/* 콘텐츠 */}
      <div style={styles.content}>
        {activeTab === "quiz" && <QuizTab />}
        {activeTab === "prayer" && <PrayerTab />}
        {activeTab === "character" && <CharacterTab />}
      </div>

      {/* 하단 탭바 */}
      <div style={styles.tabBar}>
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
    minHeight: "100vh",
    backgroundColor: "#F6F6F9",
    display: "flex",
    flexDirection: "column",
  },
  content: {
    flex: 1,
    paddingBottom: "80px",
    overflowY: "auto",
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
    paddingBottom: "env(safe-area-inset-bottom, 20px)",
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
