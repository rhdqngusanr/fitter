import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { Public, Roles, CurrentUser, type RequestUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PortfoliosService } from './portfolios.service';
import {
  attachPortfolioImageSchema,
  draftPortfolioSchema,
  galleryQuerySchema,
  proProfileSchema,
  type AttachPortfolioImageInput,
  type DraftPortfolioInput,
  type GalleryQueryInput,
  type ProProfileInput,
} from './portfolio.dto';

@Controller()
export class PortfoliosController {
  constructor(private readonly portfolios: PortfoliosService) {}

  /* ── 시공자 프로필 ─────────────────────────────────────── */

  @Roles('PRO')
  @Get('me/pro-profile')
  async myProfile(@CurrentUser() actor: RequestUser) {
    return this.portfolios.myProProfile(actor.id);
  }

  /** 승인 대기 중에도 쓸 수 있다. 대기 시간을 빈 화면으로 두면 돌아오지 않는다. */
  @Roles('PRO')
  @Put('me/pro-profile')
  async saveProfile(
    @CurrentUser() actor: RequestUser,
    @Body(new ZodValidationPipe(proProfileSchema)) body: ProProfileInput,
  ) {
    return this.portfolios.saveProProfile(actor.id, body);
  }

  /* ── 포트폴리오 ────────────────────────────────────────── */

  @Roles('PRO')
  @Post('portfolios')
  async createDraft(@CurrentUser() actor: RequestUser) {
    return this.portfolios.createDraft(actor.id);
  }

  @Roles('PRO')
  @Patch('portfolios/:id')
  async patch(
    @CurrentUser() actor: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(draftPortfolioSchema)) body: DraftPortfolioInput,
  ) {
    return this.portfolios.patch(actor.id, id, body);
  }

  @Roles('PRO')
  @Post('portfolios/:id/images')
  async attachImage(
    @CurrentUser() actor: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(attachPortfolioImageSchema)) body: AttachPortfolioImageInput,
  ) {
    return this.portfolios.attachImage(actor.id, id, body);
  }

  /** 미승인 시공자는 여기서 403이다. */
  @Roles('PRO')
  @Post('portfolios/:id/publish')
  @HttpCode(200)
  async publish(@CurrentUser() actor: RequestUser, @Param('id') id: string) {
    return this.portfolios.publish(actor.id, id);
  }

  @Roles('PRO')
  @Delete('portfolios/:id')
  @HttpCode(204)
  async remove(@CurrentUser() actor: RequestUser, @Param('id') id: string): Promise<void> {
    await this.portfolios.remove(actor.id, id);
  }

  @Roles('PRO')
  @Get('me/portfolios')
  async listMine(@CurrentUser() actor: RequestUser) {
    return this.portfolios.listMine(actor.id);
  }

  /* ── 공개 갤러리 ───────────────────────────────────────── */

  /**
   * 비로그인 공개.
   *
   * 포트폴리오 사진은 시공자 본인의 작업물이라 공개 권리를 확보할 수 있다.
   * 의뢰 사진과 정반대인 이유가 그것이다.
   */
  @Public()
  @Get('portfolios')
  async gallery(@Query(new ZodValidationPipe(galleryQuerySchema)) query: GalleryQueryInput) {
    return this.portfolios.gallery(query);
  }

  @Public()
  @Get('portfolios/:id')
  async detail(@Param('id') id: string, @CurrentUser() actor?: RequestUser) {
    return this.portfolios.detail(id, actor?.id);
  }
}
