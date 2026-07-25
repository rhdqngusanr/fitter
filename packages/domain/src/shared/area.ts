/**
 * 평 ↔ 제곱미터.
 *
 * 확장 규약 1조: 평수는 숫자로 받고 area_m2 는 파생한다. 자유 텍스트는 금지다.
 * "24평쯤이요" 같은 입력을 허용하면 2차에서 이 데이터로 계산을 할 수 없다.
 *
 * 근거: brain/20-도메인/확장 규약.md 1조
 */

import { ValidationError } from './errors';

/** 1평 = 400/121 ㎡ (약 3.3058). 상수를 흩뿌리지 않고 여기 하나만 둔다. */
export const SQUARE_METERS_PER_PYEONG = 400 / 121;

/** 현실적인 주거·상가 범위. 벗어나면 오타이거나 장난이다. */
export const MIN_PYEONG = 1;
export const MAX_PYEONG = 1000;

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
