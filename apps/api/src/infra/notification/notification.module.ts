import { Global, Module } from '@nestjs/common';

import { InAppNotificationAdapter } from './in-app-notification.adapter';

/**
 * 알림 주입 지점.
 *
 * 채널을 바꾸거나 늘려도(이메일·푸시·알림톡) 여기 한 줄만 바뀐다.
 * 상태머신은 이벤트를 발행할 뿐 어디로 가는지 모른다.
 */
export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');

@Global()
@Module({
  providers: [
    InAppNotificationAdapter,
    { provide: NOTIFICATION_PORT, useExisting: InAppNotificationAdapter },
  ],
  exports: [NOTIFICATION_PORT],
})
export class NotificationModule {}
