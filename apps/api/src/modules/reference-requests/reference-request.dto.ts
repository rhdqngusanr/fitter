import { z } from 'zod';

import { MAX_PYEONG, MIN_PYEONG } from '@fitter/domain';
import {
  HOUSING_TYPES,
  IMAGE_SOURCE_TYPES,
  MATERIAL_GRADES,
  MAX_REFERENCE_IMAGES,
} from '@fitter/shared';

/**
 * 의뢰 등록 스키마.
 *
 * **타입이 곧 확장 규약이다.** 평수는 `number`이지 `string`이 아니고,
 * 지역은 시군구 코드이지 주소 문자열이 아니며, 공종은 코드 배열이지 한글 라벨이 아니다.
 * 시안에서 이 셋이 전부 자유 텍스트였고, 그대로 두면 2차에 스키마를 갈아엎어야 했다.
 *
 * 근거: brain/20-도메인/확장 규약.md · brain/30-설계/시안 검수 결과.md
 */

/** 다단계 폼이라 스텝마다 부분 저장한다. 그래서 draft 단계에서는 대부분 선택이다. */
export const draftRequestSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(2000).optional(),

  /* 확장 규약 1조 — 숫자다. 자유 텍스트를 받는 필드는 존재하지 않는다. */
  areaPyeong: z.number().min(MIN_PYEONG).max(MAX_PYEONG).optional(),
  housingType: z.enum(HOUSING_TYPES).optional(),
  /* 확장 규약 3조 — 시군구 코드다. 주소 원문을 받는 필드는 존재하지 않는다. */
  regionCode: z.string().length(5).optional(),
  /* 확장 규약 2조 — WorkCategory.code 배열이다. 한글 라벨이 아니다. */
  workCategoryCodes: z.array(z.string().min(1).max(40)).max(13).optional(),

  desiredStartAt: z.coerce.date().optional(),
  desiredEndAt: z.coerce.date().optional(),
  isOccupied: z.boolean().optional(),
  materialGrade: z.enum(MATERIAL_GRADES).optional(),

  /* 선택이지만 2차 가격 기능의 핵심 데이터원이다. 화면에서 입력을 유도한다. */
  budgetMin: z.number().int().positive().optional(),
  budgetMax: z.number().int().positive().optional(),

  /* 현장 변수. ADR-010이 요구했다. 전부 선택. */
  floor: z.number().int().min(-5).max(100).optional(),
  hasElevator: z.boolean().optional(),
  needsDemolition: z.boolean().optional(),
});
export type DraftRequestInput = z.infer<typeof draftRequestSchema>;

/** 사진 등록. 출처는 사진마다 받는다 — 전역 동의 하나로는 되짚을 수 없다. */
export const attachImageSchema = z.object({
  storageKey: z.string().min(1).max(300),
  sourceType: z.enum(IMAGE_SOURCE_TYPES),
  sourceUrl: z.string().max(2048).optional(),
  sortOrder: z.number().int().min(0).max(MAX_REFERENCE_IMAGES).default(0),
  isCover: z.boolean().default(false),
});
export type AttachImageInput = z.infer<typeof attachImageSchema>;

export const listQuerySchema = z.object({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export type ListQueryInput = z.infer<typeof listQuerySchema>;
