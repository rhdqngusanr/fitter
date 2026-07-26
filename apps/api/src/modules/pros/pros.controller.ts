import { Controller, Get, Param, Query } from '@nestjs/common';

import { Public } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { proListQuerySchema, type ProListQueryInput } from './pro.dto';
import { ProsService } from './pros.service';

/**
 * 시공자 목록·상세 (C-06 · C-07).
 *
 * **비로그인 공개다.** 포트폴리오가 공개인데 그걸 만든 사람이 비공개면 앞뒤가 안 맞는다 —
 * 갤러리 카드에서 시공자 이름을 이미 보여주고 있고, 여기는 그 이름을 눌렀을 때 가는 곳이다.
 *
 * 연락처는 어느 응답에도 없다. 이 조회는 `phone` 을 아예 SELECT 하지 않는다 —
 * 직렬화가 걸러주더라도 메모리에 올리지 않는 편이 낫다.
 */
@Controller()
export class ProsController {
  constructor(private readonly pros: ProsService) {}

  @Public()
  @Get('pros')
  async list(@Query(new ZodValidationPipe(proListQuerySchema)) query: ProListQueryInput) {
    return this.pros.list({ ...query, costPublic: query.costPublic === 'true' });
  }

  /** 없는 시공자·미승인·휴면이 전부 같은 404 다. 구분하면 "존재한다"가 샌다. */
  @Public()
  @Get('pros/:id')
  async detail(@Param('id') id: string) {
    return this.pros.detail(id);
  }
}
