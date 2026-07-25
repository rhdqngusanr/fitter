import { Body, Controller, Delete, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import { ValidationError, type ImageNamespace } from '@fitter/domain';
import { MAX_IMAGE_BYTES } from '@fitter/shared';

import { CurrentUser, type RequestUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ImagesService } from './images.service';

const presignSchema = z.object({
  namespace: z.enum(['REFERENCE', 'PORTFOLIO']),
  contentType: z.string().min(1).max(100),
  contentLength: z.number().int().positive().max(MAX_IMAGE_BYTES),
  /** 이미 올린 장수. 서버가 소유 리소스로 다시 세는 건 P4-3/P4-4에서 붙는다. */
  currentCount: z.number().int().min(0).max(100).default(0),
});
type PresignInput = z.infer<typeof presignSchema>;

/**
 * 의뢰 사진과 포트폴리오 사진이 공유하는 업로드 엔드포인트.
 *
 * 실제 사진 행을 만드는 건 각 엔티티의 컨트롤러(P4-3 / P4-4)이고,
 * 그쪽이 ImagesService.verifyAndConsume 을 부른다.
 */
@Controller('images')
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Post('presign')
  async presign(
    @CurrentUser() actor: RequestUser,
    @Body(new ZodValidationPipe(presignSchema)) body: PresignInput,
  ) {
    return this.images.presign({
      userId: actor.id,
      namespace: body.namespace as ImageNamespace,
      contentType: body.contentType,
      contentLength: body.contentLength,
      currentCount: body.currentCount,
    });
  }

  /**
   * 업로드 중 취소.
   *
   * 클라이언트가 그냥 창을 닫아도 정리 배치가 가져가지만,
   * 명시적으로 취소하면 즉시 지워 스토리지에 잔여물이 남지 않는다.
   */
  @Delete()
  async discard(@CurrentUser() actor: RequestUser, @Query('storageKey') storageKey?: string) {
    if (!storageKey) throw new ValidationError('storageKey가 필요합니다.');
    await this.images.discard({ userId: actor.id, storageKey });
    return { discarded: true };
  }
}
