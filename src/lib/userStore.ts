// ── 유저 데이터 타입 ──
export interface UserData {
  userKey: string;
  quizLives: number;
  quizHighScore: number;
  quizTotalPoints: number;
  readPrayers: number[];
  profile: {
    ageGroup?: string;
    lifeStage?: string;
    family?: string;
    interests?: string[];
  } | null;
  lastVisit: string;
}

const STORAGE_KEY = "_miniapp_data";

const DEFAULT_DATA: UserData = {
  userKey: "",
  quizLives: 2,
  quizHighScore: 0,
  quizTotalPoints: 0,
  readPrayers: [],
  profile: null,
  lastVisit: new Date().toISOString(),
};

// ── 유저 키 획득 ──
let cachedUserKey: string | null = null;

async function getUserKey(): Promise<string> {
  if (cachedUserKey) return cachedUserKey;

  try {
    const framework = await import("@apps-in-toss/web-framework");
    if (framework.getAnonymousKey?.isSupported?.()) {
      const result = await framework.getAnonymousKey();
      cachedUserKey = result.anonymousKey;
      return cachedUserKey;
    }
  } catch {}

  // 로컬 테스트용 폴백
  let localKey = localStorage.getItem("_miniapp_user_key");
  if (!localKey) {
    localKey = "local_" + Math.random().toString(36).slice(2);
    localStorage.setItem("_miniapp_user_key", localKey);
  }
  cachedUserKey = localKey;
  return cachedUserKey;
}

// ── localStorage 읽기/쓰기 ──
export async function loadUserData(): Promise<UserData> {
  const key = await getUserKey();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_DATA, ...JSON.parse(raw), userKey: key };
    }
  } catch {}

  return { ...DEFAULT_DATA, userKey: key };
}

export async function saveUserData(data: Partial<UserData>): Promise<void> {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    const merged = {
      ...(existing ? JSON.parse(existing) : DEFAULT_DATA),
      ...data,
      lastVisit: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {}
}

export { getUserKey };
