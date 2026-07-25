import { describe, expect, it } from '@jest/globals';

import { NoopEstimatePolicy } from './noop-estimate-policy';
import type { EstimateInput } from './estimate-policy';

/**
 * 확장 규약 5조가 실제로 지켜지는지 확인한다.
 *
 * MVP에서 견적은 항상 null 이다. 그게 정상이고, 예외를 던지지 않는다.
 * 이 테스트는 "자리를 비워뒀다"는 사실 자체를 검증한다.
 */
describe('NoopEstimatePolicy (확장 규약 5조)', () => {
  const input: EstimateInput = {
    areaPyeong: 24,
    workCategoryCodes: ['WALLPAPER', 'FLOORING'],
    sidoCode: '11',
    sigunguCode: '11290',
    materialGrade: 'STANDARD',
  };

  it('MVP에서는 항상 null을 반환한다', async () => {
    const policy = new NoopEstimatePolicy();
    await expect(policy.estimate(input)).resolves.toBeNull();
  });

  it('입력이 무엇이든 예외를 던지지 않는다 — 견적 부재는 정상 상태다', async () => {
    const policy = new NoopEstimatePolicy();
    await expect(policy.estimate({ ...input, workCategoryCodes: [] })).resolves.toBeNull();
  });
});
