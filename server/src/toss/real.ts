import type { Env } from "../env";
import type { NotiType, TossClient } from "./client";

const SEND_URL =
  "https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/messenger/send-message";

interface ToTossResponse {
  resultType?: "SUCCESS" | string;
  result?: { contentId?: string };
  error?: { errorCode?: string; reason?: string };
}

/**
 * 실제 토스 스마트 발송 호출.
 *
 * 인증: mTLS — `env.TOSS_CERT.fetch(...)`로 호출하면 Cloudflare가 자동으로 클라 인증서 attach.
 *
 * 템플릿 코드는 토스 콘솔에서 등록 후 `wrangler.toml`의 vars에 넣어야 함:
 * - `TOSS_TEMPLATE_DAILY`
 * - `TOSS_TEMPLATE_STREAK_WARN`
 */
export function createRealTossClient(env: Env): TossClient {
  const templateCodes: Record<NotiType, string | undefined> = {
    daily: env.TOSS_TEMPLATE_DAILY,
    streak_warn: env.TOSS_TEMPLATE_STREAK_WARN,
  };

  return {
    async sendMessage(input) {
      if (!env.TOSS_CERT) {
        return { ok: false, error: "TOSS_CERT binding missing" };
      }
      const templateSetCode = templateCodes[input.type];
      if (!templateSetCode) {
        return {
          ok: false,
          error: `template code env var missing for type=${input.type}`,
        };
      }

      try {
        const res = await env.TOSS_CERT.fetch(SEND_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-toss-user-key": input.userKey,
          },
          body: JSON.stringify({
            templateSetCode,
            context: input.context ?? {},
          }),
        });

        const data = (await res.json().catch(() => null)) as
          | ToTossResponse
          | null;

        if (!res.ok) {
          return {
            ok: false,
            error: `HTTP ${res.status} ${JSON.stringify(data)}`,
          };
        }
        if (data?.resultType !== "SUCCESS") {
          return {
            ok: false,
            error: JSON.stringify(data?.error ?? data ?? "unknown"),
          };
        }
        return { ok: true, messageId: data.result?.contentId };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}
