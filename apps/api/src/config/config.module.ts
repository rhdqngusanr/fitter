import { Global, Module } from '@nestjs/common';

import { ENV, loadEnv } from './env';

/**
 * 검증된 환경변수를 앱 전체에 주입한다.
 * process.env를 코드 아무 데서나 읽지 않는다. 읽는 곳이 늘어나면 무엇이 필수인지 알 수 없게 된다.
 */
@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }],
  exports: [ENV],
})
export class ConfigModule {}
