export type AgeGroup = "10대" | "20대" | "30대" | "40대" | "50대" | "60대+";
export type LifeStage = "학생" | "구직자" | "직장인" | "자영업" | "주부" | "은퇴";
export type FamilyStatus = "미혼" | "기혼" | "부모" | "싱글부모" | "돌봄";
export type FocusArea =
  | "진로"
  | "업무"
  | "건강"
  | "관계"
  | "재정"
  | "신앙"
  | "자녀양육"
  | "부모봉양"
  | "학업"
  | "마음치유";

export interface UserProfile {
  ageGroup: AgeGroup;
  lifeStage: LifeStage;
  family: FamilyStatus;
  focus: FocusArea[];
}

export const AGE_OPTIONS: AgeGroup[] = ["10대", "20대", "30대", "40대", "50대", "60대+"];
export const LIFE_OPTIONS: LifeStage[] = ["학생", "구직자", "직장인", "자영업", "주부", "은퇴"];
export const FAMILY_OPTIONS: FamilyStatus[] = ["미혼", "기혼", "부모", "싱글부모", "돌봄"];
export const FOCUS_OPTIONS: FocusArea[] = [
  "진로",
  "업무",
  "건강",
  "관계",
  "재정",
  "신앙",
  "자녀양육",
  "부모봉양",
  "학업",
  "마음치유",
];

const STORAGE_KEY = "userProfile.v1";

export function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: UserProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function clearProfile() {
  localStorage.removeItem(STORAGE_KEY);
}

// 프로필 값을 기도 태그와 매칭할 수 있는 문자열 배열로 변환
export function profileToTags(p: UserProfile): string[] {
  return [p.ageGroup, p.lifeStage, p.family, ...p.focus];
}

// 기도와 프로필의 매칭 점수
export function matchScore(prayerTags: string[] | undefined, profile: UserProfile | null): number {
  if (!prayerTags || prayerTags.length === 0) return 0;
  if (!profile) return prayerTags.includes("보편") ? 1 : 0;
  const userTags = new Set(profileToTags(profile));
  let score = 0;
  for (const t of prayerTags) {
    if (userTags.has(t)) score += 2;
  }
  // 보편 태그는 +1 (누구나 볼 수 있음을 살짝 반영)
  if (prayerTags.includes("보편")) score += 1;
  return score;
}
