/**
 * 정책 상수 — **정본.**
 *
 * 시안에서 이미지 용량이 의뢰 20MB / 포트폴리오 10MB로 갈라져 있었다.
 * 같은 값이 두 곳에 있으면 반드시 한쪽이 낡는다. 그래서 여기 하나만 둔다.
 *
 * 근거: brain/20-도메인/이미지 파이프라인.md · brain/70-산출물/PRD.md 7장
 */

/** 장당 상한. 클라이언트가 먼저 거르고 서버가 매직 넘버로 다시 검증한다. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const MIN_REFERENCE_IMAGES = 1;
export const MAX_REFERENCE_IMAGES = 10;
export const MAX_PORTFOLIO_IMAGES = 15;

/** 확장자는 믿지 않는다. 이건 클라이언트 1차 필터와 안내 문구용이다. */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/** 목록용과 상세용. **목록에서 원본을 절대 로드하지 않는다.** */
export const THUMBNAIL_LIST_WIDTH = 400;
export const THUMBNAIL_DETAIL_WIDTH = 1200;

/** 업로드 전 클라이언트에서 이 폭으로 줄인다. 요즘 폰 사진은 4000px가 넘는다. */
export const CLIENT_RESIZE_MAX_WIDTH = 2000;

/** 컨택 무응답 만료. 판정을 배치로 할지 조회 시점에 할지는 아직 미결(열린 질문 Q4). */
export const CONTACT_EXPIRY_DAYS = 7;

/*
 * 면적 상수.
 *
 * 규칙(변환 함수·검증)은 `packages/domain` 에 있고 여기에는 **숫자만** 둔다.
 * 웹이 domain 을 import 할 수 없기 때문이다(의존 방향은 항상 안쪽이다).
 * 그렇다고 화면에서 3.3058 을 다시 적으면 정본이 둘로 갈라진다.
 * domain 도 여기서 가져다 쓴다.
 */

/** 1평 = 400/121 ㎡ (약 3.3058). */
export const SQUARE_METERS_PER_PYEONG = 400 / 121;

/**
 * 현실적인 주거·상가 범위. 벗어나면 오타이거나 장난이다.
 * 상한이 낮을수록 오타(240 → 2400)를 더 잘 잡는다.
 */
export const MIN_PYEONG = 1;
export const MAX_PYEONG = 500;

/*
 * 시공자 프로필 입력 한도 (P-01).
 *
 * 위의 면적 상수와 같은 이유로 여기 있다 — 화면(P-01)과 완성도 계산(domain)이
 * 같은 숫자를 봐야 하고, 화면은 domain 을 import 할 수 없다.
 */

/**
 * 공종은 최대 3개.
 *
 * 데이터 제약이 아니라 **제품 판단**이다. 고른 조합이 곧 의뢰 피드(P-04)라서,
 * 다 고르면 필터가 아무것도 걸러내지 않는 목록이 된다.
 * 서버 스키마는 13개까지 받는다 — 화면이 더 엄격한 쪽이다.
 */
export const PRO_CATEGORY_LIMIT = 3;

/** 소개는 300자. 카드에 실리는 글이라 길어지면 아무도 안 읽는다. */
export const PRO_INTRO_LIMIT = 300;
