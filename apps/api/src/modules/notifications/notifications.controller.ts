import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';

import { CurrentUser, type RequestUser } from '../../common/decorators';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * 인앱 알림.
 *
 * 전용 목록 화면(G-04)은 [[백로그]] B-05로 미뤘지만 API는 필요하다 —
 * 헤더 뱃지와 컨택 목록이 이걸 읽는다.
 */
@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() actor: RequestUser) {
    const items = await this.prisma.notification.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, kind: true, resourceId: true, readAt: true, createdAt: true },
    });
    return { items, unreadCount: items.filter((n) => n.readAt === null).length };
  }

  @Post('read')
  @HttpCode(200)
  async readAll(@CurrentUser() actor: RequestUser) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  @Post(':id/read')
  @HttpCode(200)
  async readOne(@CurrentUser() actor: RequestUser, @Param('id') id: string) {
    /* userId 조건을 함께 건다. 남의 알림을 읽음 처리할 수 없다. */
    const result = await this.prisma.notification.updateMany({
      where: { id, userId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}
