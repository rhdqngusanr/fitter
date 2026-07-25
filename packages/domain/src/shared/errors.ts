/**
 * 도메인 에러.
 *
 * 도메인은 HTTP를 모른다. 여기서는 "무엇이 잘못됐는가"만 말하고,
 * 상태 코드로 옮기는 일은 apps/api/src/common/errors 의 필터가 한다.
 *
 * 근거: brain/30-설계/구조적 원칙.md 1조
 */

export type DomainErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'VALIDATION_FAILED'
  | 'INVALID_TRANSITION'
  | 'RATE_LIMITED';

export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;

  /** 로그와 응답에 함께 실을 부가 정보. 개인정보를 넣지 않는다. */
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.details = Object.freeze({ ...details });
    Error.captureStackTrace?.(this, new.target);
  }
}

/** 대상이 없다. 권한 때문에 숨긴 경우도 이걸 쓴다. */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND' as const;
}

/** 역할은 맞지만 이 리소스의 주체가 아니다. */
export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN' as const;
}

/** 이미 처리됐거나 중복이다. 컨택 중복 요청이 여기 해당한다. */
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT' as const;
}

/** 입력이 규칙을 어겼다. 확장 규약 위반(자유 텍스트 평수 등)도 여기로 온다. */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_FAILED' as const;
}

/**
 * 불가능한 상태 전이.
 *
 * 상태만 맞아서는 안 되고 주체까지 맞아야 한다는 규칙을 어겼을 때도 이걸 던진다.
 * 조용히 무시하지 않는다. 근거: brain/20-도메인/상태머신 - 컨택.md
 */
export class InvalidTransitionError extends DomainError {
  readonly code = 'INVALID_TRANSITION' as const;
}

/** 요청 빈도 제한. 시공자의 무차별 제안을 막는 자리. */
export class RateLimitedError extends DomainError {
  readonly code = 'RATE_LIMITED' as const;
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
