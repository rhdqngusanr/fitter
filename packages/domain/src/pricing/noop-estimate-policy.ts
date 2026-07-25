import type { EstimateInput, EstimatePolicy, EstimateResult } from './estimate-policy';

/**
 * MVP 구현체. 항상 null 을 반환한다.
 *
 * 가격 기능은 2차다. 데이터가 없으면 계산이 불가능하기 때문이다.
 * 지금 필요한 건 계산이 아니라 **계산이 들어올 자리와 그 자리를 채울 데이터**다.
 *
 * 근거: brain/10-제품/리스크 - 가격 신뢰.md — "아무것도 구현하지 않는다. 대신 데이터를 제대로 받는다."
 */
export class NoopEstimatePolicy implements EstimatePolicy {
  estimate(_input: EstimateInput): Promise<EstimateResult | null> {
    return Promise.resolve(null);
  }
}
