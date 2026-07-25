import { Injectable, Logger } from '@nestjs/common';

import type { NotificationMessage, NotificationPort } from '@fitter/domain';

import { PrismaService } from '../prisma/prisma.service';

/**
 * 인앱 알림 구현체.
 *
 * MVP는 DB에 쌓고 화면이 읽는다. 이메일·푸시·알림톡은 나중에 붙이는데,
 * **그때 바꾸는 건 이 파일 하나다** — 도메인은 NotificationPort만 안다.
 *
 * 발송 실패가 상태 전이를 되돌리지 않는다. 알림은 부수 효과이지 전이의 조건이 아니다.
 * 그래서 여기서 예외를 밖으로 내보내지 않는다.
 *
 * 근거: brain/30-설계/구조적 원칙.md 2·4조
 */
@Injectable()
export class InAppNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(InAppNotificationAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  async send(message: NotificationMessage): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId: message.recipientUserId,
          kind: message.kind,
          resourceId: message.resourceId,
          payload: (message.payload ?? undefined) as never,
        },
      });
    } catch (error) {
      /* 알림이 안 갔다고 수락이 취소되면 안 된다. 로그만 남기고 넘어간다. */
      this.logger.error({ kind: message.kind, err: error }, '알림 저장 실패');
    }
  }
}
