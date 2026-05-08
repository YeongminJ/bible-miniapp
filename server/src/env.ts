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
}
