/** 토스 스마트 발송(sendMessage) 추상화. mock/real이 같은 인터페이스를 구현. */

export type NotiType = "daily" | "streak_warn";

export interface SendMessageInput {
  /** 수신자 식별자 (Toss OAuth로 받은 userKey) */
  userKey: string;
  /** 푸시 분류. 토스 콘솔에 등록된 템플릿 코드와 매핑됨. */
  type: NotiType;
  /** 토스 템플릿 변수 치환에 쓸 컨텍스트. 미니앱 도메인 데이터(스트릭 일수 등). */
  context?: Record<string, string | number>;
}

export interface SendMessageResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export interface TossClient {
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
}
