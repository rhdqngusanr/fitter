import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { ConfigModule } from './config/config.module';
import { LoggingModule } from './common/logging/logging.module';
import { DomainExceptionFilter } from './common/errors/domain-exception.filter';
import { HealthModule } from './health/health.module';
import { EstimatePolicyModule } from './modules/pricing/estimate-policy.module';

/**
 * 앱 루트.
 *
 * 여기 있는 건 전부 "바깥 링"이다. 도메인은 @fitter/domain 에 있고 이 파일을 모른다.
 *
 * 앞으로 modules/ 아래에 auth · users · requests · portfolios · contacts ·
 * work-categories · images · notifications 가 붙는다. 각각은 도메인을 호출할 뿐
 * 비즈니스 규칙을 직접 들고 있지 않는다.
 *
 * 근거: brain/30-설계/구조적 원칙.md
 */
@Module({
  imports: [ConfigModule, LoggingModule, EstimatePolicyModule, HealthModule],
  providers: [
    /* 도메인 에러를 HTTP로 옮기는 지점. 앱 전체에 한 번만 건다. */
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule {}
