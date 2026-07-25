import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';

import { ValidationError } from '@fitter/domain';

import { CurrentUser, Public, type RequestUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * 신고.
 *
 * **저작권 신고는 비로그인도 할 수 있다.** 권리자가 우리 서비스에 계정이 있을 이유가 없다.
 * 계정을 만들라고 요구하면 그 사람은 신고 대신 내용증명을 보낸다.
 *
 * 저작권과 일반 신고를 하나의 엔드포인트로 합치되 유형에 따라 받는 필드가 다르다.
 * 백로그 B-03에서 화면은 합치기로 했지만 **필드와 즉시 비공개 경로는 유지한다** —
 * 저작권 리스크 대응의 실체는 화면 분리가 아니라 필드와 처리 경로다.
 *
 * 근거: brain/10-제품/리스크 - 레퍼런스 사진 저작권.md
 */
const reportSchema = z
  .object({
    type: z.enum(['COPYRIGHT', 'INAPPROPRIATE', 'SPAM']),
    targetType: z.enum(['REFERENCE_REQUEST', 'PORTFOLIO_ITEM', 'USER']),
    targetId: z.string().uuid(),
    reason: z.string().trim().max(1000).optional(),

    /* 저작권일 때만 받는다. 권리자를 특정할 수 없으면 처리할 수 없다. */
    rightsHolderName: z.string().trim().max(100).optional(),
    rightsHolderContact: z.string().trim().max(200).optional(),
    originalSourceUrl: z.string().trim().max(2048).optional(),
  })
  .refine((v) => v.type !== 'COPYRIGHT' || (!!v.rightsHolderName && !!v.rightsHolderContact), {
    message: '저작권 신고는 권리자 이름과 연락처가 필요합니다.',
  });
type ReportInput = z.infer<typeof reportSchema>;

@Controller('reports')
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Post()
  async create(
    @Body(new ZodValidationPipe(reportSchema)) body: ReportInput,
    @CurrentUser() actor?: RequestUser,
  ) {
    /* 저작권이 아니면 로그인이 필요하다. 익명 신고 폭탄을 막는다. */
    if (body.type !== 'COPYRIGHT' && !actor) {
      throw new ValidationError('로그인이 필요합니다.');
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId: actor?.id ?? null,
        type: body.type,
        targetType: body.targetType,
        targetId: body.targetId,
        reason: body.reason ?? null,
        rightsHolderName: body.rightsHolderName ?? null,
        rightsHolderContact: body.rightsHolderContact ?? null,
        originalSourceUrl: body.originalSourceUrl ?? null,
      },
      select: { id: true, status: true, createdAt: true },
    });

    /*
     * 저작권 신고는 접수 즉시 대상 이미지에 내림 요청 플래그를 세운다.
     * 관리자가 확인하기 전이라도 "요청이 들어왔다"는 사실은 남아야 하고,
     * 화면은 이 플래그를 보고 선제적으로 가릴 수 있다.
     */
    if (body.type === 'COPYRIGHT' && body.targetType === 'REFERENCE_REQUEST') {
      await this.prisma.referenceImage.updateMany({
        where: { referenceRequestId: body.targetId, deletedAt: null },
        data: { isTakedownRequested: true, takedownRequestedAt: new Date() },
      });
    }

    return report;
  }
}
