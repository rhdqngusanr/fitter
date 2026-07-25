/**
 * 사용자와 역할.
 *
 * 여기에 들어올 것 (P4-1에서 구현):
 * - user.ts          계정
 * - role.ts          CUSTOMER / PRO / ADMIN
 * - pro-profile.ts   승인 상태(is_approved)와 프로필 완성도
 *
 * 계정당 역할은 하나다(잠정). 다만 스키마는 User 1—N UserProfile 로 열어두고
 * MVP에서는 애플리케이션 레벨에서 1개로 막는다. 열린 질문 Q2.
 *
 * `phone` 은 컨택이 수락되기 전까지 **어떤 API 응답에도 포함되지 않는다.**
 * 이 통제는 응답 직렬화 레이어에서 강제한다. 도메인은 값을 들고 있을 뿐이다.
 *
 * 근거: brain/20-도메인/엔티티 - User와 역할.md · brain/30-설계/권한 모델.md
 */
export {};
