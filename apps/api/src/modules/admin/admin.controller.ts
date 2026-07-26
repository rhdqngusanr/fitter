import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';

import { Roles } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminService } from './admin.service';

/**
 * 관리자 (A-01 · A-02).
 *
 * 승인 게이트가 없으면 검증되지 않은 시공자가 고객에게 노출된다.
 * 전에는 화면이 없어서([[백로그]] B-02) API 와 수동 DB 작업으로 운영했고,
 * 2026-07-26 에 화면을 붙였다.
 *
 * ADMIN 은 가입 경로가 없고 시드로만 만든다.
 * **로직은 `AdminService` 에 있다** — 컨트롤러가 Prisma 를 직접 부르지 않는다.
 */
const approveSchema = z.object({
  approved: z.boolean(),
  /** 반려에는 사유가 필요하다. 사유 없는 반려는 시공자가 무엇을 고칠지 알 수 없다. */
  reason: z.string().trim().max(500).optional(),
});
type ApproveInput = z.infer<typeof approveSchema>;

const resolveSchema = z.object({ accept: z.boolean() });
type ResolveInput = z.infer<typeof resolveSchema>;

@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('pro-approvals')
  async pendingPros() {
    return this.admin.approvalQueue();
  }

  @Post('pro-approvals/:userProfileId')
  @HttpCode(200)
  async decide(
    @Param('userProfileId') userProfileId: string,
    @Body(new ZodValidationPipe(approveSchema)) body: ApproveInput,
  ) {
    return this.admin.decide(userProfileId, body.approved, body.reason);
  }

  @Get('reports')
  async reports() {
    return this.admin.reportQueue();
  }

  @Post('reports/:id/resolve')
  @HttpCode(200)
  async resolve(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(resolveSchema)) body: ResolveInput,
  ) {
    return this.admin.resolveReport(id, body.accept);
  }
}
