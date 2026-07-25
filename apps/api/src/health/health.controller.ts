import { Controller, Get } from '@nestjs/common';

/**
 * 헬스체크.
 *
 * 뼈대 단계의 유일한 엔드포인트다. 배포 환경의 liveness 확인용이자,
 * 통합 테스트가 "앱이 실제로 뜬다"를 검증하는 지점이다.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok'; service: string } {
    return { status: 'ok', service: 'fitter-api' };
  }
}
