import { DomainError, type DomainErrorCode } from '@fitter/domain';

/**
 * 인증 실패.
 *
 * 도메인이 아니라 여기 있는 이유는, 인증은 도메인 개념이 아니라 전송 계층의 관심사이기 때문이다.
 * 도메인은 "이 행위자가 이 리소스의 주인인가"를 알지 "토큰이 만료됐는가"는 모른다.
 *
 * 다만 에러 응답 포맷을 통일하기 위해 DomainError를 상속한다.
 * 그래야 domain-exception.filter가 같은 모양으로 직렬화한다.
 */
export class UnauthenticatedError extends DomainError {
  readonly code = 'UNAUTHENTICATED' as DomainErrorCode;
}
