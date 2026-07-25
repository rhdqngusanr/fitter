/**
 * 역할 기반 권한 — **여기 한 곳에서만 강제한다.**
 *
 * 권한은 두 층이고 성격이 다르므로 같은 곳에서 처리하지 않는다.
 *   역할 검사(CUSTOMER / PRO / ADMIN, 그리고 승인된 PRO인가) → **Guard, 즉 여기**
 *   소유자 검사(내 의뢰인가, 내 포트폴리오인가)              → common/authz 의 재사용 유틸
 *
 * 소유자 검사가 여기 올 수 없는 이유는 리소스를 읽어봐야 알 수 있기 때문이다.
 *
 * 근거: brain/30-설계/권한 모델.md · brain/50-결정/ADR-002 - 인증과 권한 모델.md
 */

export * from './jwt-auth.guard';
export * from './roles.guard';
export * from './approved-pro.guard';
