import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

import { type DomainErrorCode, isDomainError } from '@fitter/domain';

/**
 * 도메인 에러 → HTTP 매핑.
 *
 * **도메인은 HTTP를 모른다.** 상태 코드를 아는 건 이 파일 하나뿐이고,
 * 그래서 나중에 프로토콜이 바뀌어도 도메인은 그대로다.
 *
 * 근거: brain/30-설계/구조적 원칙.md 1조
 */
const STATUS_BY_CODE: Readonly<Record<DomainErrorCode, HttpStatus>> = {
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  CONFLICT: HttpStatus.CONFLICT,
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  INVALID_TRANSITION: HttpStatus.CONFLICT,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
};

interface ErrorBody {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;
}

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();
    const requestId = typeof request.id === 'string' ? request.id : undefined;

    if (isDomainError(exception)) {
      const status = STATUS_BY_CODE[exception.code];
      this.logger.warn({ code: exception.code, requestId, details: exception.details });
      response.status(status).json({
        code: exception.code,
        message: exception.message,
        details: exception.details,
        requestId,
      } satisfies ErrorBody);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json({
        code: 'HTTP_ERROR',
        message: exception.message,
        requestId,
      } satisfies ErrorBody);
      return;
    }

    /* 정체를 모르는 예외는 내부 정보를 흘리지 않는다. 스택은 로그에만 남긴다. */
    this.logger.error({ requestId, err: exception }, '처리되지 않은 예외');
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_ERROR',
      message: '요청을 처리하지 못했습니다.',
      requestId,
    } satisfies ErrorBody);
  }
}
