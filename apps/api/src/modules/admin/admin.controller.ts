import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';

import { ConflictError, NotFoundError } from '@fitter/domain';

import { Roles } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * 관리자.
 *
 * 화면은 [[백로그]] B-02로 미뤘지만 **API와 승인 로직은 필요하다** —
 * 승인 게이트가 없으면 검증되지 않은 시공자가 고객에게 노출된다.
 * 화면 대신 시드와 이 API로 운영한다.
 *
 * ADMIN은 가입 경로가 없고 시드로만 만든다.
 */
const approveSchema = z.object({
  approved: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});
type ApproveInput = z.infer<typeof approveSchema>;

const resolveSchema = z.object({ accept: z.boolean() });
type ResolveInput = z.infer<typeof resolveSchema>;

@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('pro-approvals')
  async pendingPros() {
    const items = await this.prisma.proProfile.findMany({
      where: { isApproved: false },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: {
        userProfileId: true,
        businessName: true,
        careerYears: true,
        businessNumber: true,
        createdAt: true,
        userProfile: { select: { user: { select: { id: true, nickname: true, email: true } } } },
      },
    });
    return { items };
  }

  @Post('pro-approvals/:userProfileId')
  @HttpCode(200)
  async decide(
    @Param('userProfileId') userProfileId: string,
    @Body(new ZodValidationPipe(approveSchema)) body: ApproveInput,
  ) {
    const profile = await this.prisma.proProfile.findUnique({
      where: { userProfileId },
      select: { isApproved: true, userProfile: { select: { userId: true } } },
    });
    if (!profile) throw new NotFoundError('시공자 프로필을 찾을 수 없습니다.');
    if (profile.isApproved && body.approved) {
      throw new ConflictError('이미 승인된 시공자입니다.');
    }

    await this.prisma.proProfile.update({
      where: { userProfileId },
      data: {
        isApproved: body.approved,
        approvedAt: body.approved ? new Date() : null,
        rejectionReason: body.approved ? null : (body.reason ?? null),
      },
    });

    /*
     * 승인하면 이 시공자의 PUBLISHED 포트폴리오가 별도 조작 없이 공개된다.
     * 공개 조건 두 번째가 여기 걸려 있기 때문이다. 철회하면 즉시 사라진다.
     */
    await this.prisma.notification.create({
      data: {
        userId: profile.userProfile.userId,
        kind: body.approved ? 'PRO_APPROVED' : 'PRO_REJECTED',
        resourceId: null,
      },
    });

    return { userProfileId, isApproved: body.approved };
  }

  @Get('reports')
  async reports() {
    const items = await this.prisma.report.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: {
        id: true,
        type: true,
        targetType: true,
        targetId: true,
        reason: true,
        rightsHolderName: true,
        createdAt: true,
      },
    });
    return { items };
  }

  @Post('reports/:id/resolve')
  @HttpCode(200)
  async resolve(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(resolveSchema)) body: ResolveInput,
  ) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      select: { status: true, type: true, targetType: true, targetId: true },
    });
    if (!report) throw new NotFoundError('신고를 찾을 수 없습니다.');
    if (report.status !== 'PENDING') throw new ConflictError('이미 처리된 신고입니다.');

    await this.prisma.report.update({
      where: { id },
      data: { status: body.accept ? 'ACCEPTED' : 'REJECTED', resolvedAt: new Date() },
    });

    /* 인정하면 즉시 비공개 처리한다. 권리자가 기다릴 이유가 없다. */
    if (body.accept) {
      if (report.targetType === 'REFERENCE_REQUEST') {
        await this.prisma.referenceRequest.updateMany({
          where: { id: report.targetId },
          data: { status: 'HIDDEN' },
        });
      } else if (report.targetType === 'PORTFOLIO_ITEM') {
        await this.prisma.portfolioItem.updateMany({
          where: { id: report.targetId },
          data: { status: 'HIDDEN' },
        });
      }
    }

    return { id, status: body.accept ? 'ACCEPTED' : 'REJECTED' };
  }
}
