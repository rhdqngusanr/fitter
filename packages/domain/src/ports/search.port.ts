/**
 * 검색 포트.
 *
 * MVP는 PostgreSQL 인덱스로 시작한다. 검색이 무거워지면 이 뒤에서 전문 검색엔진으로
 * 갈아 끼운다. API 계약은 바뀌지 않는다.
 *
 * 근거: brain/50-결정/ADR-001 - 기술 스택 선정.md — 검색 확장 경로
 */

import type { Cursor, Page } from '../shared/pagination';

export interface SearchQuery {
  readonly keyword?: string;
  /** WorkCategory.code 목록. 한글 라벨이 아니다. */
  readonly workCategoryCodes?: readonly string[];
  readonly sidoCode?: string;
  readonly sigunguCode?: string;
  readonly after?: Cursor;
  readonly limit?: number;
}

export interface SearchPort<T> {
  search(query: SearchQuery): Promise<Page<T>>;
}
