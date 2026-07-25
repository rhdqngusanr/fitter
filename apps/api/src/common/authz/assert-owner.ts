import { NotFoundError } from '@fitter/domain';

/**
 * 소유자 검사.
 *
 * **엔드포인트마다 조건문을 짜지 않는다. 반드시 어딘가 빠진다.**
 * 특히 곁가지 엔드포인트(사진 등록, 요약 조회)에서 잘 빠지고,
 * 남의 의뢰에 내 사진을 붙일 수 있으면 저작권 신고가 엉뚱한 계정으로 간다.
 *
 * 실패는 **403이 아니라 404**다. 403은 "그 리소스가 존재한다"를 알려준다.
 * 남의 DRAFT 의뢰나 남의 컨택은 존재 자체가 비밀이다.
 *
 * 근거: brain/50-결정/ADR-002 - 인증과 권한 모델.md 결정 4 · brain/70-산출물/API 명세.md
 */
export function assertOwner(ownerId: string | null | undefined, actorId: string): void {
  if (!ownerId || ownerId !== actorId) {
    throw new NotFoundError('대상을 찾을 수 없습니다.');
  }
}

/** 컨택 당사자 검사. 요청자든 수신자든 둘 중 하나면 통과한다. */
export function assertParticipant(
  contact: { requesterUserId: string; receiverUserId: string },
  actorId: string,
): void {
  if (contact.requesterUserId !== actorId && contact.receiverUserId !== actorId) {
    throw new NotFoundError('대상을 찾을 수 없습니다.');
  }
}
