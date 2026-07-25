import { describe, expect, it } from '@jest/globals';

import { ForbiddenError } from '../shared/errors';
import {
  assertCanPerform,
  canPerform,
  isPortfolioPubliclyVisible,
  type ProApprovalState,
} from './pro-approval';

const pending: ProApprovalState = { isApproved: false, isDormant: false };
const approved: ProApprovalState = { isApproved: true, isDormant: false };
const dormant: ProApprovalState = { isApproved: true, isDormant: true };

describe('시공자 승인 게이트', () => {
  describe('미승인 상태에서 가능한 것', () => {
    it.each(['PROFILE_EDIT', 'PORTFOLIO_DRAFT', 'REQUEST_BROWSE'] as const)(
      '%s 는 승인 전에도 가능하다',
      (action) => {
        expect(canPerform(pending, action)).toBe(true);
      },
    );
  });

  describe('미승인 상태에서 불가능한 것', () => {
    it.each(['PORTFOLIO_PUBLISH', 'CONTACT_SEND', 'PRO_LISTING'] as const)(
      '%s 는 승인이 필요하다',
      (action) => {
        expect(canPerform(pending, action)).toBe(false);
        expect(() => assertCanPerform(pending, action)).toThrow(ForbiddenError);
      },
    );
  });

  it('승인되면 전부 가능하다', () => {
    expect(canPerform(approved, 'PORTFOLIO_PUBLISH')).toBe(true);
    expect(canPerform(approved, 'CONTACT_SEND')).toBe(true);
  });

  it('휴면 계정은 승인됐어도 아무것도 못 한다', () => {
    expect(canPerform(dormant, 'PROFILE_EDIT')).toBe(false);
    expect(canPerform(dormant, 'PORTFOLIO_PUBLISH')).toBe(false);
  });

  describe('포트폴리오 공개 조건은 두 개다', () => {
    it('PUBLISHED + 승인 이어야 공개된다', () => {
      expect(isPortfolioPubliclyVisible('PUBLISHED', approved)).toBe(true);
    });

    it('PUBLISHED 여도 미승인이면 노출되지 않는다', () => {
      expect(isPortfolioPubliclyVisible('PUBLISHED', pending)).toBe(false);
    });

    it('승인됐어도 DRAFT면 노출되지 않는다', () => {
      expect(isPortfolioPubliclyVisible('DRAFT', approved)).toBe(false);
    });
  });
});
