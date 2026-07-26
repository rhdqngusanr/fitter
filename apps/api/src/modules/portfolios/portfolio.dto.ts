import { z } from 'zod';

import { MAX_PYEONG, MIN_PYEONG } from '@fitter/domain';
import { HOUSING_TYPES, IMAGE_PHASES, MATERIAL_GRADES, MAX_PORTFOLIO_IMAGES } from '@fitter/shared';

/** 포트폴리오도 의뢰와 같은 확장 규약을 따른다. 평수는 숫자, 지역은 코드, 공종은 FK. */
export const draftPortfolioSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(2000).optional(),

  areaPyeong: z.number().min(MIN_PYEONG).max(MAX_PYEONG).optional(),
  housingType: z.enum(HOUSING_TYPES).optional(),
  regionCode: z.string().length(5).optional(),
  workCategoryCodes: z.array(z.string().min(1).max(40)).max(13).optional(),

  workDays: z.number().int().min(1).max(365).optional(),
  workedAt: z.coerce.date().optional(),
  materialGrade: z.enum(MATERIAL_GRADES).optional(),

  /**
   * 실제 비용 공개.
   *
   * 강제할 수 없으니 유인으로 접근한다 — 공개하면 신뢰도 뱃지를 준다.
   * 금액만 남기면 쓸모가 없어서 공종·평수·시공연월·자재등급·지역이 같은 행에 정규화된다.
   * 근거: brain/50-결정/ADR-010 - 가격 정책 모델.md
   */
  isCostPublic: z.boolean().optional(),
  actualCost: z.number().int().positive().max(2_000_000_000).nullable().optional(),
});
export type DraftPortfolioInput = z.infer<typeof draftPortfolioSchema>;

/** 포트폴리오 사진은 출처 대신 단계(BEFORE/AFTER/PROCESS)를 받는다. */
export const attachPortfolioImageSchema = z.object({
  storageKey: z.string().min(1).max(300),
  phase: z.enum(IMAGE_PHASES).optional(),
  sortOrder: z.number().int().min(0).max(MAX_PORTFOLIO_IMAGES).default(0),
  isCover: z.boolean().default(false),
});
export type AttachPortfolioImageInput = z.infer<typeof attachPortfolioImageSchema>;

/**
 * 시공자 프로필. 승인 심사의 대상이다.
 *
 * 상한이 화면(P-01)과 다른 곳이 둘 있고, 둘 다 **서버가 더 관대한 쪽**이다.
 *
 * - `intro` — 화면은 300자에서 막지만 서버는 2000자를 받는다. 이미 저장된 긴 소개를
 *   거부하지 않기 위해서다. 새 데이터는 화면이 300자로 들어온다.
 * - `workCategoryCodes` — 화면은 3개까지만 고르게 하지만 서버는 13개를 받는다.
 *   3개 제한은 "고른 조합이 곧 의뢰 피드"라는 제품 판단이고 데이터 제약이 아니다.
 *
 * 반대 방향(서버가 더 엄격)으로 만들면 화면이 통과시킨 입력이 저장에서 터진다.
 */
export const proProfileSchema = z.object({
  businessName: z.string().trim().min(1).max(60),
  intro: z.string().trim().max(2000).optional(),
  careerYears: z.number().int().min(0).max(70).optional(),
  businessNumber: z.string().trim().max(20).optional(),
  workCategoryCodes: z.array(z.string().min(1).max(40)).max(13).optional(),
  regionCodes: z.array(z.string().length(5)).max(30).optional(),
  /**
   * 화면의 `지금 일감 받는 중` 토글의 반대값이다.
   *
   * 컬럼은 처음부터 있었지만 입력 스키마에 없어서 **끌 방법이 없었다.**
   * 휴면은 승인 취소와 다르다 — 본인이 잠시 내려두는 것이고 되돌릴 수 있어야 한다.
   */
  isDormant: z.boolean().optional(),
});
export type ProProfileInput = z.infer<typeof proProfileSchema>;

/**
 * 목록 필터.
 *
 * 공종과 지역은 **복수 선택이 OR**다. "도배 또는 타일"이지 "도배이면서 타일"이 아니다.
 * 후자는 콘텐츠가 적은 초기에 거의 항상 0건이 된다.
 *
 * 평수·주거형태 필터는 백로그 B-06으로 미뤘다. 데이터는 정확히 받고 있으므로
 * 나중에 파라미터만 열면 된다 — 안 받은 데이터는 소급되지 않지만 안 만든 필터는 만들면 된다.
 */
const csv = z
  .string()
  .max(300)
  .transform((value) =>
    value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  );

export const galleryQuerySchema = z.object({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  categories: csv.optional(),
  regions: csv.optional(),
  /* popular은 조회수 순이다. 초기엔 데이터가 없어 latest와 거의 같다. */
  sort: z.enum(['latest', 'popular']).default('latest'),
});
export type GalleryQueryInput = z.infer<typeof galleryQuerySchema>;
