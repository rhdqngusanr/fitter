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

/** 시공자 프로필. 승인 심사의 대상이다. */
export const proProfileSchema = z.object({
  businessName: z.string().trim().min(1).max(60),
  intro: z.string().trim().max(2000).optional(),
  careerYears: z.number().int().min(0).max(70).optional(),
  businessNumber: z.string().trim().max(20).optional(),
  workCategoryCodes: z.array(z.string().min(1).max(40)).max(13).optional(),
  regionCodes: z.array(z.string().length(5)).max(30).optional(),
});
export type ProProfileInput = z.infer<typeof proProfileSchema>;

export const galleryQuerySchema = z.object({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export type GalleryQueryInput = z.infer<typeof galleryQuerySchema>;
