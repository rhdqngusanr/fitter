import { Body, Controller, Get, Post } from '@nestjs/common';

import { ConflictError, NotFoundError } from '@fitter/domain';

import { CurrentUser, type RequestUser } from '../../common/decorators';
import { REVEALED_PHONE_KEY } from '../../common/interceptors';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { selectProfileSchema, type SelectProfileInput } from '../auth/auth.dto';

@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 본인 정보.
   *
   * **`phone`이 포함되는 유일한 경로다.** 남의 것과 구분되는 예외이고,
   * 나머지 모든 응답에서는 컨택이 ACCEPTED일 때만 실린다.
   */
  @Get()
  async me(@CurrentUser() actor: RequestUser) {
    const user = await this.prisma.user.findFirst({
      where: { id: actor.id, deletedAt: null },
      select: {
        id: true,
        email: true,
        nickname: true,
        phone: true,
        profiles: { where: { deletedAt: null }, select: { type: true }, take: 1 },
      },
    });
    if (!user) throw new NotFoundError('사용자를 찾을 수 없습니다.');

    const { profiles, phone, ...rest } = user;
    return {
      ...rest,
      profileType: profiles[0]?.type ?? null,
      /* 본인 것이므로 명시적으로 공개한다. 직렬화 인터셉터가 이 이름만 통과시킨다. */
      [REVEALED_PHONE_KEY]: phone,
    };
  }

  /**
   * 역할 선택 (US-002).
   *
   * 역할 미선택 상태는 `user_profiles` 행이 **없는** 것으로 표현된다.
   * nullable 컬럼보다 정직하다.
   *
   * MVP에서는 계정당 프로필 1개다. **DB가 아니라 여기서 막는다** —
   * 지금 UNIQUE(user_id)를 걸면 2차에 다중 역할을 열 때 그걸 지우는 마이그레이션이 또 필요하다.
   * 제약을 푸는 순간이 곧 기능을 여는 순간이어야 한다.
   *
   * 근거: brain/50-결정/ADR-002 - 인증과 권한 모델.md 결정 2
   */
  /*
   * 파이프를 @UsePipes(메서드 단위)가 아니라 @Body(파라미터 단위)에 붙인다.
   * 메서드 단위로 걸면 @CurrentUser() 로 들어온 사용자 객체까지 이 스키마로 검증하려 든다.
   */
  @Post('profile')
  async selectProfile(
    @CurrentUser() actor: RequestUser,
    @Body(new ZodValidationPipe(selectProfileSchema)) body: SelectProfileInput,
  ) {
    const existing = await this.prisma.userProfile.findFirst({
      where: { userId: actor.id, deletedAt: null },
      select: { type: true },
    });
    if (existing) {
      throw new ConflictError('이미 역할이 선택되어 있습니다.', { current: existing.type });
    }

    await this.prisma.$transaction(async (tx) => {
      const profile = await tx.userProfile.create({
        data: { userId: actor.id, type: body.type },
        select: { id: true },
      });
      if (body.type === 'CUSTOMER') {
        await tx.customerProfile.create({ data: { userProfileId: profile.id } });
      } else {
        /* PRO는 가입 직후 미승인이다. 관리자가 수동으로 승인한다. */
        await tx.proProfile.create({
          data: { userProfileId: profile.id, businessName: '', isApproved: false },
        });
      }
    });

    return {
      profileType: body.type,
      /* 역할별 기본 리디렉션. 화면 경로는 brain/30-설계/화면 목록.md 를 따른다. */
      next: body.type === 'CUSTOMER' ? '/requests/new' : '/pro/profile',
    };
  }
}
