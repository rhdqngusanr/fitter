/**
 * 열거형 — 도메인 용어집이 코드가 되는 자리.
 *
 * **이 값들을 임의로 바꾸지 마라.** 화면·API·DB가 같은 이름을 쓴다.
 * 값은 SCREAMING_SNAKE, DB 컬럼은 snake_case, 코드 식별자는 camelCase.
 *
 * 근거: brain/20-도메인/도메인 용어집.md
 */

export const ROLES = ['CUSTOMER', 'PRO', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/**
 * 컨택 상태.
 *
 * "매칭 완료"라는 상태는 만들지 않는다. 실제 계약 여부를 플랫폼이 알 수 없다.
 * ACCEPTED는 연락처가 공개됐다는 뜻일 뿐이다.
 */
export const CONTACT_STATUSES = [
  'REQUESTED',
  'ACCEPTED',
  'DECLINED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/** 종료 상태에서 나가는 전이는 없다. 마음이 바뀌면 새 요청을 만든다. */
export const TERMINAL_CONTACT_STATUSES = ['ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED'] as const;

export const CONTACT_DIRECTIONS = ['PRO_TO_REQUEST', 'CUSTOMER_TO_PRO'] as const;
export type ContactDirection = (typeof CONTACT_DIRECTIONS)[number];

export const REQUEST_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED', 'HIDDEN'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const PORTFOLIO_STATUSES = ['DRAFT', 'PUBLISHED', 'HIDDEN'] as const;
export type PortfolioStatus = (typeof PORTFOLIO_STATUSES)[number];

export const HOUSING_TYPES = ['APARTMENT', 'VILLA', 'OFFICETEL', 'HOUSE', 'COMMERCIAL'] as const;
export type HousingType = (typeof HOUSING_TYPES)[number];

export const MATERIAL_GRADES = ['BASIC', 'STANDARD', 'PREMIUM'] as const;
export type MaterialGrade = (typeof MATERIAL_GRADES)[number];

/**
 * 의뢰 사진의 출처.
 *
 * EXTERNAL이면 source_url이 필수이고 URL 형식을 검증한다.
 * 저작권 대응의 핵심이라 전역 동의 체크박스 하나로 대체할 수 없다.
 *
 * 근거: brain/10-제품/리스크 - 레퍼런스 사진 저작권.md
 */
export const IMAGE_SOURCE_TYPES = ['SELF', 'EXTERNAL'] as const;
export type ImageSourceType = (typeof IMAGE_SOURCE_TYPES)[number];

/** 포트폴리오 사진의 단계. before/after 대비가 실력을 가장 잘 보여준다. */
export const IMAGE_PHASES = ['BEFORE', 'AFTER', 'PROCESS'] as const;
export type ImagePhase = (typeof IMAGE_PHASES)[number];

/** 화면에 표시할 한국어 라벨. DB에는 위의 코드만 저장한다. */
export const HOUSING_TYPE_LABELS: Readonly<Record<HousingType, string>> = {
  APARTMENT: '아파트',
  VILLA: '빌라·연립',
  OFFICETEL: '오피스텔',
  HOUSE: '단독',
  COMMERCIAL: '상가',
};

export const MATERIAL_GRADE_LABELS: Readonly<Record<MaterialGrade, string>> = {
  BASIC: '보급',
  STANDARD: '중급',
  PREMIUM: '고급',
};
