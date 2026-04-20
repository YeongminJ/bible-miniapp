import { useState } from "react";
import {
  AGE_OPTIONS,
  LIFE_OPTIONS,
  FAMILY_OPTIONS,
  FOCUS_OPTIONS,
  saveProfile,
  type UserProfile,
  type AgeGroup,
  type LifeStage,
  type FamilyStatus,
  type FocusArea,
} from "../lib/profile";

interface Props {
  initial?: UserProfile | null;
  onDone: (profile: UserProfile) => void;
  onSkip?: () => void;
  title?: string;
}

const MAX_FOCUS = 3;

export default function ProfileSelector({ initial, onDone, onSkip, title }: Props) {
  const [age, setAge] = useState<AgeGroup | null>(initial?.ageGroup ?? null);
  const [life, setLife] = useState<LifeStage | null>(initial?.lifeStage ?? null);
  const [family, setFamily] = useState<FamilyStatus | null>(initial?.family ?? null);
  const [focus, setFocus] = useState<FocusArea[]>(initial?.focus ?? []);

  const ready = age && life && family && focus.length > 0;

  const toggleFocus = (f: FocusArea) => {
    setFocus((prev) => {
      if (prev.includes(f)) return prev.filter((x) => x !== f);
      if (prev.length >= MAX_FOCUS) return prev;
      return [...prev, f];
    });
  };

  const submit = () => {
    if (!ready) return;
    const profile: UserProfile = {
      ageGroup: age!,
      lifeStage: life!,
      family: family!,
      focus,
    };
    saveProfile(profile);
    onDone(profile);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.scroll}>
        <div style={styles.header}>
          {onSkip && (
            <button style={styles.closeBtn} onClick={onSkip} aria-label="닫기">×</button>
          )}
          <h2 style={styles.title}>{title ?? "맞춤 기도 설정"}</h2>
          <p style={styles.subtitle}>
            몇 가지만 선택하면 나에게 어울리는 기도가 먼저 보여요.
          </p>
        </div>

      <Section label="연령대">
        <ChipRow
          options={AGE_OPTIONS}
          selected={age ? [age] : []}
          onPick={(v) => setAge(v as AgeGroup)}
        />
      </Section>

      <Section label="삶의 단계">
        <ChipRow
          options={LIFE_OPTIONS}
          selected={life ? [life] : []}
          onPick={(v) => setLife(v as LifeStage)}
        />
      </Section>

      <Section label="가족 상태">
        <ChipRow
          options={FAMILY_OPTIONS}
          selected={family ? [family] : []}
          onPick={(v) => setFamily(v as FamilyStatus)}
        />
      </Section>

      <Section label={`관심 영역 (최대 ${MAX_FOCUS}개)`}>
        <ChipRow
          options={FOCUS_OPTIONS}
          selected={focus}
          onPick={(v) => toggleFocus(v as FocusArea)}
          multi
        />
      </Section>

      </div>
      <div style={styles.footer}>
        {onSkip && (
          <button style={styles.skip} onClick={onSkip}>
            나중에 하기
          </button>
        )}
        <button
          style={{ ...styles.submit, opacity: ready ? 1 : 0.4, cursor: ready ? "pointer" : "not-allowed" }}
          onClick={submit}
          disabled={!ready}
        >
          저장하고 시작하기
        </button>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionLabel}>{label}</div>
      {children}
    </div>
  );
}

function ChipRow({
  options,
  selected,
  onPick,
  multi = false,
}: {
  options: readonly string[];
  selected: string[];
  onPick: (v: string) => void;
  multi?: boolean;
}) {
  return (
    <div style={styles.chipRow}>
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onPick(opt)}
            style={{
              ...styles.chip,
              backgroundColor: on ? "#0D9488" : "#F3F4F6",
              color: on ? "#FFFFFF" : "#374151",
              borderColor: on ? "#0D9488" : "transparent",
            }}
          >
            {multi && on ? "✓ " : ""}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#F9FAFB",
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
  },
  scroll: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "24px 20px 24px",
  },
  header: {
    marginBottom: "24px",
    textAlign: "center" as const,
    position: "relative" as const,
  },
  closeBtn: {
    position: "absolute" as const,
    top: -8,
    right: -8,
    width: 40,
    height: 40,
    border: "none",
    background: "transparent",
    fontSize: 28,
    color: "#6B7280",
    cursor: "pointer",
    lineHeight: 1,
  },
  title: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#111827",
    margin: "0 0 8px",
  },
  subtitle: {
    fontSize: "14px",
    color: "#6B7280",
    margin: 0,
    lineHeight: 1.5,
  },
  section: {
    marginBottom: "20px",
    backgroundColor: "#FFFFFF",
    borderRadius: "16px",
    padding: "16px 16px 14px",
  },
  sectionLabel: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#0D9488",
    marginBottom: "12px",
    letterSpacing: "0.3px",
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px",
  },
  chip: {
    padding: "10px 14px",
    borderRadius: "100px",
    fontSize: "14px",
    fontWeight: 600,
    border: "2px solid transparent",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  footer: {
    flexShrink: 0,
    padding: "12px 20px calc(20px + env(safe-area-inset-bottom))",
    backgroundColor: "#FFFFFF",
    display: "flex",
    gap: "8px",
    borderTop: "1px solid #E5E7EB",
    zIndex: 1001,
  },
  skip: {
    padding: "14px 18px",
    borderRadius: "12px",
    backgroundColor: "#F3F4F6",
    color: "#6B7280",
    fontSize: "15px",
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
  },
  submit: {
    flex: 1,
    padding: "14px",
    borderRadius: "12px",
    backgroundColor: "#0D9488",
    color: "#FFFFFF",
    fontSize: "15px",
    fontWeight: 700,
    border: "none",
  },
};
