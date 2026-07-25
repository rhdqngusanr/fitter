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
