/**
 * 도메인 이벤트 버스 포트.
 *
 * 상태 변화는 이벤트를 낳고, 알림 같은 부수 효과는 그 이벤트를 구독한다.
 * 상태머신이 알림을 직접 호출하지 않는다.
 *
 * 지금은 인메모리 구현이어도 된다. 중요한 건 결합을 끊어두는 것이다.
 * 나중에 메시지 큐로 바꿀 때 발행 지점을 안 고쳐도 된다.
 *
 * 근거: brain/30-설계/구조적 원칙.md 4조
 */

export interface DomainEvent {
  readonly name: string;
  readonly occurredAt: Date;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface EventBusPort {
  publish(event: DomainEvent): Promise<void>;
}
