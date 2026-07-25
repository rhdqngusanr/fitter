import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';

import { Roles, CurrentUser, type RequestUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReferenceRequestsService } from './reference-requests.service';
import {
  attachImageSchema,
  draftRequestSchema,
  listQuerySchema,
  type AttachImageInput,
  type DraftRequestInput,
  type ListQueryInput,
} from './reference-request.dto';

/**
 * 경로는 brain/70-산출물/API 명세.md 를 그대로 따른다.
 *
 * 시공자용 의뢰 목록(`GET /reference-requests`)은 탐색 기능이라 P4-5에서 붙는다.
 * 여기는 고객이 자기 의뢰를 만들고 고치는 부분이다.
 */
@Controller()
export class ReferenceRequestsController {
  constructor(private readonly requests: ReferenceRequestsService) {}

  @Roles('CUSTOMER')
  @Post('reference-requests')
  async createDraft(@CurrentUser() actor: RequestUser) {
    return this.requests.createDraft(actor.id);
  }

  /** 스텝마다 부분 저장한다. 중간 이탈이 잦은 폼이라 이게 이탈률을 좌우한다. */
  @Roles('CUSTOMER')
  @Patch('reference-requests/:id')
  async patch(
    @CurrentUser() actor: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(draftRequestSchema)) body: DraftRequestInput,
  ) {
    return this.requests.patch(actor.id, id, body);
  }

  @Roles('CUSTOMER')
  @Post('reference-requests/:id/images')
  async attachImage(
    @CurrentUser() actor: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(attachImageSchema)) body: AttachImageInput,
  ) {
    return this.requests.attachImage(actor.id, id, body);
  }

  @Roles('CUSTOMER')
  @Post('reference-requests/:id/publish')
  @HttpCode(200)
  async publish(@CurrentUser() actor: RequestUser, @Param('id') id: string) {
    return this.requests.publish(actor.id, id);
  }

  @Roles('CUSTOMER')
  @Post('reference-requests/:id/close')
  @HttpCode(200)
  async close(@CurrentUser() actor: RequestUser, @Param('id') id: string) {
    return this.requests.close(actor.id, id);
  }

  @Roles('CUSTOMER')
  @Delete('reference-requests/:id')
  @HttpCode(204)
  async remove(@CurrentUser() actor: RequestUser, @Param('id') id: string): Promise<void> {
    await this.requests.remove(actor.id, id);
  }

  /** 내 의뢰 목록. DRAFT도 여기서는 보인다 — 이어쓰기를 해야 하기 때문이다. */
  @Roles('CUSTOMER')
  @Get('me/reference-requests')
  async listMine(
    @CurrentUser() actor: RequestUser,
    @Query(new ZodValidationPipe(listQuerySchema)) query: ListQueryInput,
  ) {
    return this.requests.listMine(actor.id, query.cursor, query.limit);
  }

  /**
   * 상세.
   *
   * 로그인은 필요하다 — 의뢰는 비로그인에 열지 않는다.
   * DRAFT는 소유자만 볼 수 있고 남의 것은 404다.
   */
  @Get('reference-requests/:id')
  async detail(@CurrentUser() actor: RequestUser, @Param('id') id: string) {
    return this.requests.detail(actor.id, id);
  }
}
