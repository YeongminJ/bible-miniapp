/**
 * Cloudflare Workers 바인딩 / 환경변수 타입.
 * `wrangler.toml`의 binding 이름과 1:1 매칭.
 */
export interface Env {
  /** D1 SQLite 데이터베이스 */
  DB: D1Database;

  /** mock | real — Toss API 모드 */
  TOSS_MODE: "mock" | "real";

  /** mTLS 인증서 바인딩 — `env.TOSS_CERT.fetch(...)`로 호출 시 자동 attach. */
  TOSS_CERT?: Fetcher;

  /** 토스 콘솔에 등록한 'daily' 푸시 템플릿 코드. */
  TOSS_TEMPLATE_DAILY?: string;

  /** 토스 콘솔에 등록한 'streak_warn' 푸시 템플릿 코드. */
  TOSS_TEMPLATE_STREAK_WARN?: string;

  /**
   * 토스 OAuth login-me 응답의 PII(name 등) 복호화에 쓰는 AES-256-GCM 키.
   * base64-encoded 32바이트. 콘솔에서 신청 → 이메일 수령 → `wrangler secret put`로 저장.
   * 미설정 시 서버는 평문 name을 반환하지 않음(undefined).
   */
  TOSS_LOGIN_DECRYPT_KEY?: string;

  /**
   * 토스 OAuth PII 복호화 시 AES-GCM에 함께 전달하는 Additional Authenticated Data.
   * 콘솔에서 키와 함께 발급. 미설정 시 복호화 불가 → 평문 name 반환 안 함.
   */
  TOSS_LOGIN_DECRYPT_AAD?: string;
}
