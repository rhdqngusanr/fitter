import { ForbiddenError } from '../shared/errors';

/**
 * 시공자 승인 게이트.
 *
 * **역할이 PRO인 것과 승인된 PRO인 것은 다르다.** 이 구분이 흐려지면
 * 검증되지 않은 시공자가 고객에게 노출된다.
 *
 * 여기 있는 함수들이 순수한 이유는 두 가지다. DB 없이 전 조합을 테스트할 수 있고,
 * 가드에서 부르든 서비스에서 부르든 같은 답을 주기 때문이다.
 *
 * 근거: brain/20-도메인/엔티티 - User와 역할.md · brain/50-결정/ADR-002 - 인증과 권한 모델.md 결정 5
 */

export interface ProApprovalState {
  readonly isApproved: boolean;
  readonly isDormant: boolean;
}

/**
 * 미승인 시공자가 할 수 있는 것.
 *
 * 작성을 미리 허용하는 건 제품 판단이다. 승인 대기 중 할 일이 없으면
 * 시공자는 돌아오지 않는다. 대기 시간을 빈 화면으로 두면 그 사람을 잃는다.
 */
export const ALLOWED_WHILE_PENDING = ['PROFILE_EDIT', 'PORTFOLIO_DRAFT', 'REQUEST_BROWSE'] as const;

/** 승인되어야만 할 수 있는 것. */
export const REQUIRES_APPROVAL = ['PORTFOLIO_PUBLISH', 'CONTACT_SEND', 'PRO_LISTING'] as const;

export type ProAction = (typeof ALLOWED_WHILE_PENDING)[number] | (typeof REQUIRES_APPROVAL)[number];

export function canPerform(state: ProApprovalState, action: ProAction): boolean {
  if (!REQUIRES_APPROVAL.includes(action as (typeof REQUIRES_APPROVAL)[number])) {
    /* 승인 대기 중에도 되는 것들. 다만 휴면 계정은 아무것도 못 한다. */
    return !state.isDormant;
  }
  return state.isApproved && !state.isDormant;
}

/** 불가능하면 도메인 에러를 던진다. 조용히 false를 반환하고 넘어가지 않는다. */
export function assertCanPerform(state: ProApprovalState, action: ProAction): void {
  if (canPerform(state, action)) return;

  const reason = state.isDormant
    ? '휴면 상태의 계정입니다.'
    : '관리자 승인 후에 이용할 수 있습니다.';
  throw new ForbiddenError(reason, { action, isApproved: state.isApproved });
}

/**
 * 포트폴리오가 공개되는 조건은 **두 개**다.
 * 항목이 PUBLISHED이고 소속 시공자가 승인됨. 하나만 보고 공개하는 실수가 나기 쉽다.
 */
export function isPortfolioPubliclyVisible(itemStatus: string, pro: ProApprovalState): boolean {
  return itemStatus === 'PUBLISHED' && pro.isApproved && !pro.isDormant;
}
