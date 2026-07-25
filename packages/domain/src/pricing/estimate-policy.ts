/**
 * 견적 계산의 자리.
 *
 * 확장 규약 5조. MVP에서는 계산하지 않지만 **자리를 미리 비워둔다.**
 * 빈 인터페이스를 먼저 만드는 게 과해 보일 수 있지만 이건 코드가 아니라 의도의 선언이다.
 * 6개월 뒤에 코드를 읽는 사람에게 "여기가 확장 지점이다"를 알려준다.
 *
 * 근거: brain/20-도메인/확장 규약.md 5조 · brain/10-제품/리스크 - 가격 신뢰.md
 */

export type MaterialGrade = 'BASIC' | 'STANDARD' | 'PREMIUM';

/**
 * 견적의 입력값.
 *
 * 확장 규약이 지키려는 게 정확히 이 네 가지다.
 * 평수 × 공종 × 지역 × 자재등급이 구조화되어 쌓이면 2차에 단가표만 얹으면 된다.
 * 그래서 평수는 숫자, 공종은 코드, 지역은 행정구역 코드, 자재등급은 enum 이어야 한다.
 */
export interface EstimateInput {
  readonly areaPyeong: number;
  /** WorkCategory.code 의 목록. 한글 라벨이 아니다. */
  readonly workCategoryCodes: readonly string[];
  readonly sidoCode: string;
  readonly sigunguCode: string;
  readonly materialGrade?: MaterialGrade;
}

/**
 * 견적 결과.
 *
 * 금액만 남기면 나중에 재현할 수 없다. 계산 시점의 단가표 버전과 산출 근거를 함께 남긴다.
 * 이 값이 ReferenceRequest.estimate_snapshot(JSONB) 에 통째로 들어간다.
 */
export interface EstimateResult {
  readonly minAmount: number;
  readonly maxAmount: number;
  readonly currency: 'KRW';
  /** 어떤 단가표로 계산했는가. 단가표가 바뀌어도 과거 견적을 재현할 수 있어야 한다. */
  readonly priceTableVersion: string;
  /** 공종별 산출 근거. 사용자에게 "왜 이 금액인지"를 설명하는 재료다. */
  readonly breakdown: readonly EstimateBreakdownItem[];
  readonly calculatedAt: Date;
}

export interface EstimateBreakdownItem {
  readonly workCategoryCode: string;
  readonly minAmount: number;
  readonly maxAmount: number;
  readonly note?: string;
}

/**
 * 견적 산출 정책.
 *
 * 2차에 구현체만 갈아 끼운다. 잠정 방향은 시세 공개(B) → 실거래가 집계(D) → 구간 강제(A)
 * 순의 단계 전략이며, 그 판단은 P6-1에서 다시 검토한다.
 */
export interface EstimatePolicy {
  /** 계산할 수 없으면 null 을 반환한다. 예외를 던지지 않는다. 견적 부재는 정상 상태다. */
  estimate(input: EstimateInput): Promise<EstimateResult | null>;
}
