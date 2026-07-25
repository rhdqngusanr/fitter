/**
 * 알림 포트.
 *
 * MVP는 인앱 저장 + 콘솔 출력으로 구현하되 인터페이스는 진짜로 만든다.
 * 나중에 이메일이든 푸시든 알림톡이든 갈아 끼우면 된다.
 *
 * 알림 발송 실패가 상태 전이를 되돌리지 않는다. 알림은 부수 효과이지 전이의 조건이 아니다.
 *
 * 근거: brain/30-설계/구조적 원칙.md 2·4조
 */

export type NotificationKind =
  | 'CONTACT_REQUESTED'
  | 'CONTACT_ACCEPTED'
  | 'CONTACT_DECLINED'
  | 'CONTACT_EXPIRED'
  | 'PRO_APPROVED'
  | 'PRO_REJECTED';

export interface NotificationMessage {
  readonly kind: NotificationKind;
  readonly recipientUserId: string;
  /** 클릭 시 이동할 리소스. 화면 경로는 어댑터가 만든다. */
  readonly resourceId: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export interface NotificationPort {
  send(message: NotificationMessage): Promise<void>;
}
