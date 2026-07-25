import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

import { ValidationError } from '@fitter/domain';

/**
 * zod 스키마로 요청 본문을 검증한다.
 *
 * **클라이언트 검증은 우회할 수 있으므로 서버가 진짜 방어선이다.**
 * 그리고 실패를 도메인 에러로 던져야 응답 포맷이 통일된다.
 *
 * details에 사용자 입력을 그대로 담지 않는다 — 검증 에러에 전화번호나 비밀번호가
 * 섞여 로그와 응답으로 새어나갈 수 있다. 경로와 사유만 남긴다.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ValidationError(issues[0]?.message ?? '입력값이 올바르지 않습니다.', { issues });
  }
}
