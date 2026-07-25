import { describe, expect, it } from '@jest/globals';

import { CONTACT_STATUSES } from '@fitter/shared';

import { InvalidTransitionError } from '../shared/errors';
import {
  canRevealContact,
  canTransition,
  resolveActor,
  transition,
  type ContactAction,
  type ContactSnapshot,
  type ContactStatus,
} from './transitions';

/**
 * 상태머신 - 컨택.md 가 요구한 "유효·무효 전이 조합 전부, 최소 15케이스".
 *
 * DB가 필요 없다. 그게 전이를 순수 함수로 분리한 이유다.
 */

const REQUESTER = 'user-requester';
const RECEIVER = 'user-receiver';
const STRANGER = 'user-stranger';

const contact = (status: ContactStatus): ContactSnapshot => ({
  status,
  requesterUserId: REQUESTER,
  receiverUserId: RECEIVER,
});

describe('행위자 판정', () => {
  it('요청자·수신자·제3자·시스템을 구분한다', () => {
    expect(resolveActor(contact('REQUESTED'), REQUESTER)).toBe('REQUESTER');
    expect(resolveActor(contact('REQUESTED'), RECEIVER)).toBe('RECEIVER');
    expect(resolveActor(contact('REQUESTED'), STRANGER)).toBe('STRANGER');
    expect(resolveActor(contact('REQUESTED'), null)).toBe('SYSTEM');
  });
});

describe('유효한 전이', () => {
  it('수신자가 수락하면 ACCEPTED', () => {
    expect(transition(contact('REQUESTED'), 'ACCEPT', RECEIVER)).toBe('ACCEPTED');
  });

  it('수신자가 거절하면 DECLINED', () => {
    expect(transition(contact('REQUESTED'), 'DECLINE', RECEIVER)).toBe('DECLINED');
  });

  it('요청자가 취소하면 CANCELLED', () => {
    expect(transition(contact('REQUESTED'), 'CANCEL', REQUESTER)).toBe('CANCELLED');
  });

  it('시스템이 만료시키면 EXPIRED', () => {
    expect(transition(contact('REQUESTED'), 'EXPIRE', null)).toBe('EXPIRED');
  });
});

describe('주체가 틀린 전이 — 이 상태머신의 핵심', () => {
  it('요청자는 수락할 수 없다', () => {
    expect(() => transition(contact('REQUESTED'), 'ACCEPT', REQUESTER)).toThrow(
      InvalidTransitionError,
    );
  });

  it('요청자는 거절할 수 없다', () => {
    expect(() => transition(contact('REQUESTED'), 'DECLINE', REQUESTER)).toThrow(
      InvalidTransitionError,
    );
  });

  it('수신자는 취소할 수 없다', () => {
    expect(() => transition(contact('REQUESTED'), 'CANCEL', RECEIVER)).toThrow(
      InvalidTransitionError,
    );
  });

  it('사용자가 만료를 일으킬 수 없다 — 시스템만 한다', () => {
    expect(() => transition(contact('REQUESTED'), 'EXPIRE', RECEIVER)).toThrow(
      InvalidTransitionError,
    );
    expect(() => transition(contact('REQUESTED'), 'EXPIRE', REQUESTER)).toThrow(
      InvalidTransitionError,
    );
  });

  it('제3자는 아무것도 할 수 없다', () => {
    const actions: ContactAction[] = ['ACCEPT', 'DECLINE', 'CANCEL'];
    for (const action of actions) {
      expect(() => transition(contact('REQUESTED'), action, STRANGER)).toThrow(
        InvalidTransitionError,
      );
    }
  });

  it('제3자 거부가 상태보다 먼저다 — 처리 여부가 새지 않는다', () => {
    try {
      transition(contact('ACCEPTED'), 'ACCEPT', STRANGER);
      throw new Error('예외가 나야 한다');
    } catch (error) {
      expect((error as InvalidTransitionError).message).toContain('당사자가 아닙니다');
    }
  });
});

describe('종료 상태에서는 나갈 수 없다', () => {
  const terminals: ContactStatus[] = ['ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED'];
  const actions: ContactAction[] = ['ACCEPT', 'DECLINE', 'CANCEL', 'EXPIRE'];

  it.each(terminals)('%s 에서는 어떤 전이도 불가능하다', (status) => {
    for (const action of actions) {
      expect(() => transition(contact(status), action, RECEIVER)).toThrow(InvalidTransitionError);
      expect(() => transition(contact(status), action, REQUESTER)).toThrow(InvalidTransitionError);
      expect(() => transition(contact(status), action, null)).toThrow(InvalidTransitionError);
    }
  });

  it('한 번 수락된 컨택을 다시 수락할 수 없다 — 경쟁 상태 방어', () => {
    expect(() => transition(contact('ACCEPTED'), 'ACCEPT', RECEIVER)).toThrow(
      InvalidTransitionError,
    );
  });
});

describe('canTransition 은 던지지 않는다', () => {
  it('화면이 버튼을 감출 때 쓴다', () => {
    expect(canTransition(contact('REQUESTED'), 'ACCEPT', RECEIVER)).toBe(true);
    expect(canTransition(contact('REQUESTED'), 'ACCEPT', REQUESTER)).toBe(false);
    expect(canTransition(contact('EXPIRED'), 'ACCEPT', RECEIVER)).toBe(false);
  });
});

describe('연락처 공개 판정 — 가장 위험한 지점', () => {
  it('ACCEPTED이고 당사자일 때만 공개한다', () => {
    expect(canRevealContact(contact('ACCEPTED'), REQUESTER)).toBe(true);
    expect(canRevealContact(contact('ACCEPTED'), RECEIVER)).toBe(true);
  });

  it('ACCEPTED여도 제3자에게는 공개하지 않는다', () => {
    expect(canRevealContact(contact('ACCEPTED'), STRANGER)).toBe(false);
    expect(canRevealContact(contact('ACCEPTED'), null)).toBe(false);
  });

  it.each(
    CONTACT_STATUSES.filter((s): s is Exclude<ContactStatus, 'ACCEPTED'> => s !== 'ACCEPTED'),
  )('%s 상태에서는 당사자에게도 공개하지 않는다', (status) => {
    expect(canRevealContact(contact(status), REQUESTER)).toBe(false);
    expect(canRevealContact(contact(status), RECEIVER)).toBe(false);
  });

  it('거절이나 만료로 끝난 컨택은 연락처를 열지 않는다', () => {
    expect(canRevealContact(contact('DECLINED'), REQUESTER)).toBe(false);
    expect(canRevealContact(contact('EXPIRED'), RECEIVER)).toBe(false);
  });
});
