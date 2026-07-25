import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ForbiddenError, assertCanPerform } from '@fitter/domain';

import { APPROVED_PRO_KEY, type RequestUser } from '../decorators';
import type { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * 승인된 시공자만 통과시킨다.
 *
 * **승인 여부를 토큰에 넣지 않고 매번 DB를 본다.** 토큰에 넣으면 관리자가 승인을
 * 철회해도 토큰이 만료될 때까지 반영되지 않는다. 승인 철회는 즉시 효력이 있어야 한다.
 *
 * 판단 자체는 도메인 함수(assertCanPerform)가 한다. 가드는 데이터를 물어다 줄 뿐이다.
 *
 * 근거: brain/50-결정/ADR-002 - 인증과 권한 모델.md 결정 5
 */
@Injectable()
export class ApprovedProGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(APPROVED_PRO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = request.user;
    if (!user || user.profileType !== 'PRO') {
      throw new ForbiddenError('시공자만 이용할 수 있습니다.');
    }

    const profile = await this.prisma.userProfile.findFirst({
      where: { userId: user.id, type: 'PRO', deletedAt: null },
      select: { proProfile: { select: { isApproved: true, isDormant: true } } },
    });

    const pro = profile?.proProfile;
    if (!pro) {
      throw new ForbiddenError('시공자 프로필을 먼저 작성해야 합니다.');
    }

    assertCanPerform({ isApproved: pro.isApproved, isDormant: pro.isDormant }, 'CONTACT_SEND');
    return true;
  }
}
