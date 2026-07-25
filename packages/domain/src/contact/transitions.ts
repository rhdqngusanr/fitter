import type { ContactStatus } from '@fitter/shared';

import { InvalidTransitionError } from '../shared/errors';

/**
 * 컨택 상태 전이. **기술 하이라이트 2번의 본체.**
 *
 * 이 파일의 핵심 주장은 한 문장이다 —
 * **상태만 맞아서는 안 되고 주체까지 맞아야 한다.**
 *
 * `REQUESTED`인 컨택을 수락할 수 있는 사람은 수신자뿐이다. 요청자가 자기 요청을
 * 수락하면 상태는 유효하지만 의미가 없다. 그래서 전이 함수가 행위자를 함께 받는다.
 *
 * 순수 함수인 이유는 DB 없이 전 조합을 테스트하기 위해서다.
 * 그리고 이 판단을 DB 트리거로 옮길 수 없는 이유이기도 하다 —
 * **DB는 누가 이 UPDATE를 호출했는지 모른다.**
 *
 * 근거: brain/20-도메인/상태머신 - 컨택.md
 */

/*
 * 상태 값의 정본은 @fitter/shared 다. 화면도 같은 목록을 봐야 하기 때문이다.
 * 도메인이 shared에 의존하는 건 괜찮다 — shared는 도메인 용어집이 코드가 된 것이고
 * 런타임 의존성이 없는 순수 상수·타입이다. 금지된 건 프레임워크와 인프라다.
 */
export type { ContactStatus };

/** 종료 상태에서 나가는 전이는 없다. 마음이 바뀌면 새 요청을 만든다. */
export const TERMINAL_STATUSES: readonly ContactStatus[] = [
  'ACCEPTED',
  'DECLINED',
  'CANCELLED',
  'EXPIRED',
];

export type ContactAction = 'ACCEPT' | 'DECLINE' | 'CANCEL' | 'EXPIRE';

/** 행위자가 이 컨택에서 어떤 자리에 있는가. */
export type ContactActor = 'REQUESTER' | 'RECEIVER' | 'SYSTEM' | 'STRANGER';

export interface ContactSnapshot {
  readonly status: ContactStatus;
  readonly requesterUserId: string;
  readonly receiverUserId: string;
}

/** 누가 어떤 전이를 일으킬 수 있는가. 이 표가 곧 규칙이다. */
const RULES: Readonly<
  Record<
    ContactAction,
    { readonly from: ContactStatus; readonly by: ContactActor; readonly to: ContactStatus }
  >
> = {
  ACCEPT: { from: 'REQUESTED', by: 'RECEIVER', to: 'ACCEPTED' },
  DECLINE: { from: 'REQUESTED', by: 'RECEIVER', to: 'DECLINED' },
  CANCEL: { from: 'REQUESTED', by: 'REQUESTER', to: 'CANCELLED' },
  EXPIRE: { from: 'REQUESTED', by: 'SYSTEM', to: 'EXPIRED' },
};

/** 행위자의 자리를 판정한다. 제3자는 STRANGER다. */
export function resolveActor(contact: ContactSnapshot, actorUserId: string | null): ContactActor {
  if (actorUserId === null) return 'SYSTEM';
  if (actorUserId === contact.requesterUserId) return 'REQUESTER';
  if (actorUserId === contact.receiverUserId) return 'RECEIVER';
  return 'STRANGER';
}

/**
 * 전이를 시도한다.
 *
 * 성공하면 새 상태를 반환하고, 불가능하면 **조용히 무시하지 않고** 도메인 에러를 던진다.
 * 조용히 무시하면 호출부는 성공한 줄 알고 알림을 보낸다.
 */
export function transition(
  contact: ContactSnapshot,
  action: ContactAction,
  actorUserId: string | null,
): ContactStatus {
  const rule = RULES[action];
  if (!rule) {
    throw new InvalidTransitionError('알 수 없는 동작입니다.', { action });
  }

  const actor = resolveActor(contact, actorUserId);

  /*
   * 제3자를 먼저 막는다. 상태 이야기를 꺼내기 전에 끊어야
   * "이 컨택은 이미 처리됐다" 같은 정보가 새지 않는다.
   */
  if (actor === 'STRANGER') {
    throw new InvalidTransitionError('이 컨택의 당사자가 아닙니다.', { action });
  }

  if (TERMINAL_STATUSES.includes(contact.status)) {
    throw new InvalidTransitionError('이미 종료된 컨택입니다.', {
      action,
      status: contact.status,
    });
  }

  if (contact.status !== rule.from) {
    throw new InvalidTransitionError('지금 상태에서는 할 수 없는 동작입니다.', {
      action,
      status: contact.status,
    });
  }

  /* 여기가 이 파일의 존재 이유다. 상태가 맞아도 주체가 다르면 거부한다. */
  if (actor !== rule.by) {
    throw new InvalidTransitionError('이 동작을 할 수 있는 사람이 아닙니다.', {
      action,
      expected: rule.by,
      actual: actor,
    });
  }

  return rule.to;
}

/** 던지지 않고 가능 여부만 본다. 화면에서 버튼을 감출 때 쓴다. */
export function canTransition(
  contact: ContactSnapshot,
  action: ContactAction,
  actorUserId: string | null,
): boolean {
  try {
    transition(contact, action, actorUserId);
    return true;
  } catch {
    return false;
  }
}

/**
 * 연락처를 공개해도 되는가.
 *
 * **이 프로젝트에서 가장 위험한 판정이다.** 조건은 둘 다 필요하다 —
 * 컨택이 ACCEPTED이고, 조회자가 그 컨택의 당사자일 것.
 * 응답 직렬화가 이 함수 하나만 보고 판단하게 해서 규칙이 흩어지지 않게 한다.
 *
 * 근거: brain/30-설계/권한 모델.md · brain/50-결정/ADR-002 - 인증과 권한 모델.md 결정 6
 */
export function canRevealContact(contact: ContactSnapshot, viewerUserId: string | null): boolean {
  if (contact.status !== 'ACCEPTED') return false;
  const actor = resolveActor(contact, viewerUserId);
  return actor === 'REQUESTER' || actor === 'RECEIVER';
}

/** 만료 판정. 배치가 이 함수로 대상을 고른다. */
export function isExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}
