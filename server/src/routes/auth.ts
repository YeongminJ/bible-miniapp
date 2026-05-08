import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";

const TOKEN_URL =
  "https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/generate-token";

const exchangeSchema = z.object({
  authorizationCode: z.string().min(1),
  referrer: z.string().min(1),
});

interface TossTokenResponse {
  resultType?: "SUCCESS" | string;
  result?: {
    accessToken?: string;
    refreshToken?: string;
    userKey?: string | number;
    scope?: string;
    tokenType?: string;
    expiresIn?: number;
  };
  error?: { errorCode?: string; reason?: string };
}

const route = new Hono<{ Bindings: Env }>();

/**
 * 토스 로그인 인가코드 → access token + userKey 교환.
 *
 * 클라가 `appLogin()`으로 받은 (authorizationCode, referrer)를 전달하면
 * 우리 서버가 mTLS로 토스 OAuth 엔드포인트를 호출.
 *
 * 응답: 푸시 라우팅에 쓸 `userKey`만 클라로 돌려줌.
 * (accessToken/refreshToken은 현재 시점에 우리가 쓸 일이 없어 저장 안 함.)
 */
route.post("/exchange", zValidator("json", exchangeSchema), async (c) => {
  const body = c.req.valid("json");
  if (!c.env.TOSS_CERT) {
    return c.json({ error: "TOSS_CERT binding missing" }, 500);
  }

  let res: Response;
  try {
    res = await c.env.TOSS_CERT.fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorizationCode: body.authorizationCode,
        referrer: body.referrer,
      }),
    });
  } catch (err) {
    console.error("[auth] toss oauth fetch threw", err);
    return c.json(
      { error: err instanceof Error ? err.message : String(err) },
      502,
    );
  }

  const data = (await res.json().catch(() => null)) as TossTokenResponse | null;

  if (!res.ok) {
    console.warn("[auth] toss oauth http error", res.status, data);
    return c.json(
      { error: `toss_oauth_http_${res.status}`, detail: data },
      502,
    );
  }
  if (data?.resultType !== "SUCCESS" || !data.result?.userKey) {
    console.warn("[auth] toss oauth result not SUCCESS", data);
    return c.json({ error: "toss_oauth_failed", detail: data }, 502);
  }

  return c.json({
    userKey: String(data.result.userKey),
  });
});

export default route;
