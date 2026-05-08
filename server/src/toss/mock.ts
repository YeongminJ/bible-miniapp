import type { NotiType, TossClient } from "./client";

// 기능성 검수 통과를 노린 사실 전달 톤. 유도·혜택·재촉 표현 금지.
// 실제 콘솔 등록 문구도 이 톤을 유지하세요.
const MOCK_MESSAGES: Record<NotiType, { title: string; body: string }> = {
  daily: {
    title: "오늘의 말씀",
    body: "오늘의 말씀이 도착했어요.",
  },
  streak_warn: {
    title: "연속 출석 알림",
    body: "연속 출석 기록이 오늘 종료돼요.",
  },
};

/**
 * 콘솔에만 로그를 남기는 가짜 클라이언트.
 * `wrangler tail`로 발송 이벤트 모니터링 가능.
 * 토스 mTLS 인증서 발급 전까지 default 모드.
 */
export const mockTossClient: TossClient = {
  async sendMessage(input) {
    const tpl = MOCK_MESSAGES[input.type];
    console.log(
      "[MockToss] sendMessage",
      JSON.stringify({
        ts: new Date().toISOString(),
        userKey: input.userKey,
        type: input.type,
        title: tpl.title,
        body: tpl.body,
        context: input.context,
      }),
    );
    return {
      ok: true,
      messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  },
};
