import type { Env } from "../env";
import type { TossClient } from "./client";
import { mockTossClient } from "./mock";
import { createRealTossClient } from "./real";

/**
 * 환경에 따라 mock/real 클라이언트 선택.
 * `TOSS_MODE === "real"`일 때만 실제 토스 API 호출.
 */
export function getTossClient(env: Env): TossClient {
  if (env.TOSS_MODE === "real") {
    return createRealTossClient(env);
  }
  return mockTossClient;
}
