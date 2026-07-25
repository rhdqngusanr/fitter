import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { IS_PUBLIC_KEY, type RequestUser } from '../decorators';
import { UnauthenticatedError } from '../errors/unauthenticated.error';
import type { TokenService } from '../../modules/auth/token.service';

/**
 * 전역 인증 가드.
 *
 * `APP_GUARD`로 앱 전체에 걸린다. **기본값이 "인증 필수"**이고
 * `@Public()`이 붙은 곳만 통과시킨다.
 *
 * 근거: brain/50-결정/ADR-002 - 인증과 권한 모델.md 결정 3
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const token = extractBearer(request);

    /*
     * 공개 경로여도 토큰이 있으면 해석해 둔다.
     * 갤러리처럼 "비로그인도 보이지만 로그인하면 스크랩 상태가 보이는" 화면이 있기 때문이다.
     * 다만 토큰이 깨져 있어도 공개 경로는 막지 않는다.
     */
    if (token) {
      const payload = this.tokens.verifyAccess(token);
      if (payload) {
        request.user = { id: payload.sub, profileType: payload.profileType };
      } else if (!isPublic) {
        throw new UnauthenticatedError('토큰이 유효하지 않거나 만료되었습니다.');
      }
    } else if (!isPublic) {
      throw new UnauthenticatedError('로그인이 필요합니다.');
    }

    return true;
  }
}

function extractBearer(request: Request): string | null {
  const header = request.headers.authorization;
  if (typeof header !== 'string') return null;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
  return value;
}
