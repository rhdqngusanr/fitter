import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ForbiddenError } from '@fitter/domain';
import type { Role } from '@fitter/shared';

import { ROLES_KEY, type RequestUser } from '../decorators';

/**
 * 역할 검사.
 *
 * 요청만 보고 판단할 수 있으므로 가드에서 한다.
 * **소유자 검사는 여기 오지 않는다** — 리소스를 읽어봐야 알 수 있기 때문이다.
 * 그건 서비스 레이어의 assertOwner가 한다.
 *
 * 근거: brain/30-설계/권한 모델.md
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = request.user;

    if (!user?.profileType) {
      throw new ForbiddenError('역할을 먼저 선택해야 합니다.', { required });
    }
    if (!required.includes(user.profileType)) {
      throw new ForbiddenError('이 작업을 수행할 권한이 없습니다.', { required });
    }
    return true;
  }
}
