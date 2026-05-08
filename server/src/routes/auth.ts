import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import type { Env } from "../env";

const TOKEN_URL =
  "https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/generate-token";
const LOGIN_ME_URL =
  "https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/login-me";

const exchangeSchema = z.object({
  authorizationCode: z.string().min(1),
  referrer: z.string().min(1),
});

const migrationStatusSchema = z.object({
  hash: z.string().min(1).max(200),
});

const migrationLinkSchema = z.object({
  hash: z.string().min(1).max(200),
  authorizationCode: z.string().min(1),
  referrer: z.string().min(1),
});

interface TossTokenResponse {
  resultType?: "SUCCESS" | "FAIL" | string;
  // 실제 응답은 `success` 필드. (구 문서 캐시에 result로 잘못 표기되어 있던 점 수정)
  success?: {
    accessToken?: string;
    refreshToken?: string;
    scope?: string;
    tokenType?: string;
    expiresIn?: number;
  };
  error?: { errorCode?: string; reason?: string } | string;
}

interface TossLoginMeResponse {
  resultType?: "SUCCESS" | "FAIL" | string;
  success?: {
    userKey?: number | string;
    scope?: string;
    agreedTerms?: string[];
  };
  error?: { errorCode?: string; reason?: string } | string;
}

/**
 * 토스 OAuth 2단계 교환:
 *   1) generate-token: authorizationCode → accessToken
 *   2) login-me: accessToken → userKey
 *
 * `userKey`를 받으려면 콘솔에서 OAuth scope에 `user_key`가 포함돼있고
 * 사용자가 동의해야 해요. 미인가 상태면 토스가 userKey를 안 주고 흐름이 실패.
 */
async function exchangeWithToss(
  cert: Fetcher,
  authorizationCode: string,
  referrer: string,
): Promise<{ userKey: string } | { error: string; status: number }> {
  // ── 1) generate-token ───────────────────────────────────────────
  let tokenRes: Response;
  try {
    tokenRes = await cert.fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorizationCode, referrer }),
    });
  } catch (err) {
    console.error("[toss-oauth] generate-token fetch threw", err);
    return {
      error: err instanceof Error ? err.message : String(err),
      status: 502,
    };
  }
  const tokenData = (await tokenRes.json().catch(() => null)) as
    | TossTokenResponse
    | null;
  const accessToken = tokenData?.success?.accessToken;
  if (!tokenRes.ok || tokenData?.resultType !== "SUCCESS" || !accessToken) {
    // 응답 본문은 accessToken 등 민감 정보 포함 가능 — error 부분만 추출해 로깅.
    console.error(
      "[toss-oauth] generate-token failed",
      "http",
      tokenRes.status,
      "resultType",
      tokenData?.resultType,
      "error",
      JSON.stringify(tokenData?.error ?? null),
      "referrer",
      referrer,
    );
    return { error: "toss_oauth_token_failed", status: 502 };
  }

  // ── 2) login-me ─────────────────────────────────────────────────
  let meRes: Response;
  try {
    meRes = await cert.fetch(LOGIN_ME_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    console.error("[toss-oauth] login-me fetch threw", err);
    return {
      error: err instanceof Error ? err.message : String(err),
      status: 502,
    };
  }
  const meData = (await meRes.json().catch(() => null)) as
    | TossLoginMeResponse
    | null;
  const userKey = meData?.success?.userKey;
  if (!meRes.ok || meData?.resultType !== "SUCCESS" || userKey == null) {
    // 사용자 PII (name/phone/birthday 등) 응답에 포함될 수 있음 — error 필드만 로깅.
    console.error(
      "[toss-oauth] login-me failed",
      "http",
      meRes.status,
      "resultType",
      meData?.resultType,
      "error",
      JSON.stringify(meData?.error ?? null),
      "tokenScope",
      tokenData.success?.scope,
    );
    return { error: "toss_login_me_failed", status: 502 };
  }
  return { userKey: String(userKey) };
}

const route = new Hono<{ Bindings: Env }>();

/**
 * (Legacy) 토스 OAuth 인가코드 → userKey 교환만. 매핑 저장 없음.
 * 신규 흐름은 `/migration/link` 사용. 이 라우트는 호환성을 위해 유지.
 */
route.post("/exchange", zValidator("json", exchangeSchema), async (c) => {
  const body = c.req.valid("json");
  if (!c.env.TOSS_CERT) {
    return c.json({ error: "TOSS_CERT binding missing" }, 500);
  }
  const result = await exchangeWithToss(
    c.env.TOSS_CERT,
    body.authorizationCode,
    body.referrer,
  );
  if ("error" in result) {
    console.warn("[auth/exchange] failed", result.error);
    return c.json({ error: result.error }, result.status as 502);
  }
  return c.json({ userKey: result.userKey });
});

/**
 * hash로 사용자가 토스 OAuth 매핑됐는지 조회.
 * 매핑돼있으면 클라는 `appLogin()` 다시 띄우지 않아도 됨.
 */
route.post(
  "/migration/status",
  zValidator("json", migrationStatusSchema),
  async (c) => {
    const { hash } = c.req.valid("json");
    const db = getDb(c.env.DB);
    const row = await db
      .select({ tossUserKey: users.tossUserKey })
      .from(users)
      .where(eq(users.userKey, hash))
      .get();
    return c.json({ isMapped: row?.tossUserKey != null });
  },
);

/**
 * `appLogin()` 인가코드를 받아 mTLS OAuth 교환 → 토스 userKey를 hash와 매핑 저장.
 *
 * 매핑 후에는 cron이 그 토스 userKey로 sendMessage 헤더 `x-toss-user-key`를 채움.
 * upsert 패턴: `users` row가 없으면 생성, 있으면 `toss_user_key`만 갱신.
 */
route.post(
  "/migration/link",
  zValidator("json", migrationLinkSchema),
  async (c) => {
    const { hash, authorizationCode, referrer } = c.req.valid("json");
    if (!c.env.TOSS_CERT) {
      return c.json({ error: "TOSS_CERT binding missing" }, 500);
    }
    const result = await exchangeWithToss(
      c.env.TOSS_CERT,
      authorizationCode,
      referrer,
    );
    if ("error" in result) {
      console.warn("[auth/migration/link] toss oauth failed", result.error);
      return c.json({ error: result.error }, result.status as 502);
    }

    const db = getDb(c.env.DB);
    const now = Date.now();
    await db
      .insert(users)
      .values({
        userKey: hash,
        tossUserKey: result.userKey,
        reminderMinute: null,
        dailyEnabled: true,
        streakWarnEnabled: true,
        timezone: "Asia/Seoul",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.userKey,
        set: { tossUserKey: result.userKey, updatedAt: now },
      });

    return c.json({ success: true });
  },
);

export default route;
