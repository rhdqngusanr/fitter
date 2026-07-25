import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';

import { CurrentUser, type RequestUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ContactsService } from './contacts.service';
import {
  contactListQuerySchema,
  createContactSchema,
  declineSchema,
  type ContactListQueryInput,
  type CreateContactInput,
  type DeclineInput,
} from './contact.dto';

/**
 * 컨택.
 *
 * **상태를 바꾸는 경로는 accept·decline·cancel 셋뿐이고 전부 도메인 전이 함수를 거친다.**
 * 목록에는 상태를 바꾸는 수단이 없다 — 전이는 상세에서만 일어난다.
 */
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Post()
  async create(
    @CurrentUser() actor: RequestUser,
    @Body(new ZodValidationPipe(createContactSchema)) body: CreateContactInput,
  ) {
    return this.contacts.create(actor.id, actor.profileType, body);
  }

  @Get()
  async list(
    @CurrentUser() actor: RequestUser,
    @Query(new ZodValidationPipe(contactListQuerySchema)) query: ContactListQueryInput,
  ) {
    return this.contacts.list(actor.id, query.box, query.status);
  }

  @Get(':id')
  async detail(@CurrentUser() actor: RequestUser, @Param('id') id: string) {
    return this.contacts.detail(actor.id, id);
  }

  /** 수신자만. 성공하면 같은 응답에 연락처가 열린다 — 별도 조회가 필요 없다. */
  @Post(':id/accept')
  @HttpCode(200)
  async accept(@CurrentUser() actor: RequestUser, @Param('id') id: string) {
    return this.contacts.act(actor.id, id, 'ACCEPT');
  }

  /** 수신자만. */
  @Post(':id/decline')
  @HttpCode(200)
  async decline(
    @CurrentUser() actor: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(declineSchema)) body: DeclineInput,
  ) {
    return this.contacts.act(actor.id, id, 'DECLINE', body);
  }

  /** 요청자만. */
  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@CurrentUser() actor: RequestUser, @Param('id') id: string) {
    return this.contacts.act(actor.id, id, 'CANCEL');
  }

  @Post(':id/view-contact')
  @HttpCode(200)
  async viewContact(@CurrentUser() actor: RequestUser, @Param('id') id: string) {
    return this.contacts.markContactViewed(actor.id, id);
  }
}
