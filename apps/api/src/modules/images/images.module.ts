import { Module } from '@nestjs/common';

import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import { ThumbnailQueue } from './thumbnail.queue';

@Module({
  controllers: [ImagesController],
  providers: [ImagesService, ThumbnailQueue],
  /* P4-3 의뢰 등록과 P4-4 포트폴리오가 이 서비스를 가져다 쓴다. */
  exports: [ImagesService],
})
export class ImagesModule {}
