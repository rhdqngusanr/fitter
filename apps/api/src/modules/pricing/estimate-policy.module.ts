import { Global, Module } from '@nestjs/common';

import { type EstimatePolicy, NoopEstimatePolicy } from '@fitter/domain';

/**
 * 견적 정책 주입 지점.
 *
 * 확장 규약 5조가 말하는 "계산의 자리"가 실제로 배선되는 곳이다.
 * MVP에서는 NoopEstimatePolicy가 항상 null을 돌려주고,
 * 2차에 구간형이든 실거래가 집계형이든 **이 한 줄만 바꾸면 된다.**
 *
 * 어댑터 뒤에 두는 이유가 이것이다. 호출하는 쪽은 어떤 정책인지 모른다.
 *
 * 근거: brain/20-도메인/확장 규약.md 5조 · brain/30-설계/구조적 원칙.md 2·3조
 */
export const ESTIMATE_POLICY = Symbol('ESTIMATE_POLICY');

@Global()
@Module({
  providers: [
    {
      provide: ESTIMATE_POLICY,
      useFactory: (): EstimatePolicy => new NoopEstimatePolicy(),
    },
  ],
  exports: [ESTIMATE_POLICY],
})
export class EstimatePolicyModule {}
