/**
 * 시공자 프로필 완성도.
 *
 * P-01 화면의 오른쪽 체크리스트와 퍼센트가 이 함수 하나에서 나온다.
 * **화면이 세지 않는다.** 같은 규칙을 화면과 서버가 따로 들고 있으면
 * "저장했는데 퍼센트가 안 오른다" 같은 어긋남이 반드시 생긴다.
 *
 * 필수와 권장을 구분하는 이유는 게이트가 하나뿐이기 때문이다 —
 * **활동명·공종·활동 지역 셋이 있으면 의뢰 목록(P-04)이 열린다.**
 * 나머지는 있으면 컨택 확률이 오르는 것이지 자격 요건이 아니다.
 * 처음부터 다 채우라고 하면 온보딩에서 이탈한다.
 *
 * 근거: brain/20-도메인/엔티티 - User와 역할.md · design/P-01 프로필 편집.dc.html
 */

/** 완성도 판정에 들어가는 사실들. DB 행이 아니라 사실만 받는다. */
export interface ProProfileFacts {
  readonly businessName: string;
  readonly phone: string | null;
  readonly workCategoryCount: number;
  readonly serviceAreaCount: number;
  readonly intro: string | null;
  readonly businessNumber: string | null;
}

export type ProProfileItemKey =
  | 'IDENTITY'
  | 'CATEGORIES'
  | 'SERVICE_AREAS'
  | 'INTRO'
  | 'BUSINESS_NUMBER';

export interface ProProfileItem {
  readonly key: ProProfileItemKey;
  /** 필수 항목인가. 셋만 필수다. */
  readonly required: boolean;
  readonly done: boolean;
}

export interface ProProfileCompleteness {
  readonly items: readonly ProProfileItem[];
  /** 0~100. 항목 수로 나눈 값이라 항목이 늘면 자동으로 재분배된다. */
  readonly percent: number;
  /** 필수 셋이 다 찼는가. 저장 버튼과 의뢰 목록 접근이 이걸 본다. */
  readonly requiredMet: boolean;
}

function filled(value: string | null): boolean {
  return !!value && value.trim().length > 0;
}

export function evaluateProProfile(facts: ProProfileFacts): ProProfileCompleteness {
  /*
   * 활동명과 연락처를 한 항목으로 묶는다. 둘 중 하나만 있는 프로필은
   * 고객이 컨택해도 연락이 닿지 않으므로 반쪽을 인정할 이유가 없다.
   */
  const items: ProProfileItem[] = [
    {
      key: 'IDENTITY',
      required: true,
      done: filled(facts.businessName) && filled(facts.phone),
    },
    { key: 'CATEGORIES', required: true, done: facts.workCategoryCount > 0 },
    { key: 'SERVICE_AREAS', required: true, done: facts.serviceAreaCount > 0 },
    { key: 'INTRO', required: false, done: filled(facts.intro) },
    { key: 'BUSINESS_NUMBER', required: false, done: filled(facts.businessNumber) },
  ];

  const percent = Math.round((items.filter((i) => i.done).length / items.length) * 100);

  /*
   * 필수 판정에서 연락처는 빼야 한다.
   *
   * IDENTITY 항목은 활동명 + 연락처를 함께 보지만, **의뢰 목록을 여는 조건은
   * 활동명·공종·지역 셋**이다(시안이 정한 것). 연락처까지 필수로 걸면 게이트가
   * 넷이 되어 화면이 약속한 문장("필수 항목 3개")과 어긋난다.
   */
  const requiredMet =
    filled(facts.businessName) && facts.workCategoryCount > 0 && facts.serviceAreaCount > 0;

  return { items, percent, requiredMet };
}
