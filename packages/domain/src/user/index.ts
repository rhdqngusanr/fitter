/**
 * 사용자와 역할.
 *
 * 계정당 역할은 하나다(잠정). 다만 스키마는 `users 1—N user_profiles`로 열어두고
 * MVP에서는 애플리케이션 레벨에서 1개로 막는다. 근거: ADR-002 결정 2.
 *
 * `phone`은 컨택이 수락되기 전까지 어떤 API 응답에도 포함되지 않는다.
 * 그 통제는 여기가 아니라 응답 직렬화 레이어에서 한다. 도메인은 값을 들고 있을 뿐이다.
 *
 * 아직 여기 없는 것 (P4-1 이후):
 *   user.ts        엔티티
 */

export * from './pro-approval';
export * from './pro-profile';
