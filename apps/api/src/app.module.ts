import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { ConfigModule } from './config/config.module';
import { LoggingModule } from './common/logging/logging.module';
import { DomainExceptionFilter } from './common/errors/domain-exception.filter';
import { ApprovedProGuard, JwtAuthGuard, RolesGuard } from './common/guards';
import { ContactPrivacyInterceptor } from './common/interceptors';
import { PrismaModule } from './infra/prisma/prisma.module';
import { SecurityModule } from './infra/security/security.module';
import { NotificationModule } from './infra/notification/notification.module';
import { StorageModule } from './infra/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RegionsModule } from './modules/regions/regions.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ImagesModule } from './modules/images/images.module';
import { MeModule } from './modules/me/me.module';
import { PortfoliosModule } from './modules/portfolios/portfolios.module';
import { ProsModule } from './modules/pros/pros.module';
import { ReferenceRequestsModule } from './modules/reference-requests/reference-requests.module';
import { EstimatePolicyModule } from './modules/pricing/estimate-policy.module';
import { HealthModule } from './health/health.module';

/**
 * 앱 루트.
 *
 * 여기 있는 건 전부 "바깥 링"이다. 도메인은 @fitter/domain 에 있고 이 파일을 모른다.
 *
 * 근거: brain/30-설계/구조적 원칙.md
 */
@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    PrismaModule,
    SecurityModule,
    StorageModule,
    NotificationModule,
    EstimatePolicyModule,
    AuthModule,
    MeModule,
    ImagesModule,
    ReferenceRequestsModule,
    PortfoliosModule,
    ProsModule,
    ContactsModule,
    NotificationsModule,
    RegionsModule,
    ReportsModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    /* 도메인 에러를 HTTP로 옮기는 지점. 앱 전체에 한 번만 건다. */
    { provide: APP_FILTER, useClass: DomainExceptionFilter },

    /*
     * 가드 순서가 중요하다. 인증 → 역할 → 승인 순으로 걸린다.
     * 그리고 **기본값이 "인증 필수"**다. 공개 경로만 @Public()으로 뚫는다.
     * 반대로 하면 가드를 빠뜨리는 순간 새어나간다.
     */
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ApprovedProGuard },

    /*
     * 연락처 차단. 응답이 나가는 마지막 지점이고 기본값이 "제거"다.
     * 새 엔드포인트를 추가해도 별도 조치 없이 안전한 쪽이 기본이어야 한다.
     */
    { provide: APP_INTERCEPTOR, useClass: ContactPrivacyInterceptor },
  ],
})
export class AppModule {}
