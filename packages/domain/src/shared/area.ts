/**
 * 평 ↔ 제곱미터.
 *
 * 확장 규약 1조: 평수는 숫자로 받고 area_m2 는 파생한다. 자유 텍스트는 금지다.
 * "24평쯤이요" 같은 입력을 허용하면 2차에서 이 데이터로 계산을 할 수 없다.
 *
 * 근거: brain/20-도메인/확장 규약.md 1조
 */

import { MAX_PYEONG, MIN_PYEONG, SQUARE_METERS_PER_PYEONG } from '@fitter/shared';

import { ValidationError } from './errors';

/*
 * 숫자 자체는 `@fitter/shared` 가 정본이다. 화면도 같은 값을 써야 하는데
 * 웹은 domain 을 import 할 수 없어서(의존 방향은 항상 안쪽이다) 상수만 바깥으로 뺐다.
 * 여기 남은 건 그 숫자를 쓰는 **규칙**이다. 규칙은 안쪽에 있어야 한다.
 *
 * 상한이 500인 이유는 반셀프 인테리어에서 그보다 큰 의뢰가 사실상 없기 때문이다.
 */
export { MAX_PYEONG, MIN_PYEONG, SQUARE_METERS_PER_PYEONG };

export function pyeongToSquareMeters(pyeong: number): number {
  assertValidPyeong(pyeong);
  return round2(pyeong * SQUARE_METERS_PER_PYEONG);
}

export function squareMetersToPyeong(squareMeters: number): number {
  if (!Number.isFinite(squareMeters) || squareMeters <= 0) {
    throw new ValidationError('면적은 0보다 큰 숫자여야 합니다.', { squareMeters });
  }
  return round2(squareMeters / SQUARE_METERS_PER_PYEONG);
}

export function assertValidPyeong(pyeong: number): void {
  if (!Number.isFinite(pyeong)) {
    throw new ValidationError('평수는 숫자여야 합니다.', { pyeong });
  }
  if (pyeong < MIN_PYEONG || pyeong > MAX_PYEONG) {
    throw new ValidationError(`평수는 ${MIN_PYEONG}~${MAX_PYEONG} 사이여야 합니다.`, { pyeong });
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
