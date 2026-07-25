/**
 * 공종 시드 목록 — **정본.**
 *
 * 시안 검수에서 화면마다 공종 목록이 다섯 갈래로 갈라져 있는 것이 발견됐다.
 * 고객은 의뢰할 수 있는데 시공자는 태그할 수 없는 공종이 네 개 생기는 상태였다.
 * 그래서 목록을 여기 한 곳에만 둔다. **화면이 다른 목록을 들고 있으면 그 화면이 틀린 것이다.**
 *
 * 런타임 정본은 DB의 WorkCategory 테이블이고 이 파일은 그 시드다.
 * 참조는 항상 code(FK)로 하며 한글 라벨을 저장하지 않는다.
 *
 * 근거: brain/20-도메인/엔티티 - WorkCategory.md · brain/30-설계/시안 검수 결과.md 4번
 */

export interface WorkCategorySeed {
  readonly code: string;
  readonly nameKo: string;
  readonly sortOrder: number;
}

export const WORK_CATEGORY_SEEDS: readonly WorkCategorySeed[] = [
  { code: 'WALLPAPER', nameKo: '도배', sortOrder: 10 },
  { code: 'FLOORING', nameKo: '장판·마루', sortOrder: 20 },
  { code: 'TILE', nameKo: '타일', sortOrder: 30 },
  { code: 'BATHROOM', nameKo: '욕실', sortOrder: 40 },
  { code: 'KITCHEN', nameKo: '주방', sortOrder: 50 },
  { code: 'CARPENTRY', nameKo: '목공', sortOrder: 60 },
  { code: 'FILM', nameKo: '필름', sortOrder: 70 },
  { code: 'PAINT', nameKo: '페인트', sortOrder: 80 },
  { code: 'LIGHTING_ELECTRIC', nameKo: '조명·전기', sortOrder: 90 },
  { code: 'WINDOW_DOOR', nameKo: '새시·중문', sortOrder: 100 },
  { code: 'DEMOLITION', nameKo: '철거', sortOrder: 110 },
  { code: 'GROUTING', nameKo: '줄눈', sortOrder: 120 },
  { code: 'MOVE_IN_CLEANING', nameKo: '입주청소', sortOrder: 130 },
] as const;

export const WORK_CATEGORY_CODES: readonly string[] = WORK_CATEGORY_SEEDS.map((c) => c.code);
