import { describe, expect, it } from '@jest/globals';

import { ValidationError } from './errors';
import { MAX_PYEONG, MIN_PYEONG, pyeongToSquareMeters, squareMetersToPyeong } from './area';

/**
 * 단위 테스트 예시.
 *
 * 도메인 테스트는 DB도 프레임워크도 필요 없다. 그게 도메인을 분리한 이유다.
 */
describe('면적 변환 (확장 규약 1조)', () => {
  it('24평을 제곱미터로 바꾼다', () => {
    expect(pyeongToSquareMeters(24)).toBeCloseTo(79.34, 2);
  });

  it('제곱미터에서 평으로 되돌린다', () => {
    const squareMeters = pyeongToSquareMeters(24);
    expect(squareMetersToPyeong(squareMeters)).toBeCloseTo(24, 1);
  });

  it('숫자가 아니면 거부한다 — 자유 텍스트 평수를 막는 자리', () => {
    expect(() => pyeongToSquareMeters(Number.NaN)).toThrow(ValidationError);
  });

  it('현실적인 범위를 벗어나면 거부한다', () => {
    expect(() => pyeongToSquareMeters(MIN_PYEONG - 1)).toThrow(ValidationError);
    expect(() => pyeongToSquareMeters(MAX_PYEONG + 1)).toThrow(ValidationError);
  });

  it('0 이하의 면적은 거부한다', () => {
    expect(() => squareMetersToPyeong(0)).toThrow(ValidationError);
  });
});
