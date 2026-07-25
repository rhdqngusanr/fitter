/**
 * 커서 페이지네이션.
 *
 * 오프셋은 쓰지 않는다. 데이터가 늘면 반드시 느려지고, 무한 스크롤에서 중복과 누락을 만든다.
 * 나중에 바꾸면 API 계약이 깨지므로 처음부터 커서로 간다.
 *
 * 근거: brain/30-설계/구조적 원칙.md 5조
 */

/** 커서는 클라이언트에게 불투명한 문자열이다. 내부 형식을 노출하지 않는다. */
export type Cursor = string & { readonly __brand: 'Cursor' };

export function toCursor(raw: string): Cursor {
  return raw as Cursor;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export interface PageQuery {
  /** 이 커서 "다음"부터 가져온다. 없으면 처음부터. */
  readonly after?: Cursor;
  readonly limit?: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  /** 다음 페이지가 없으면 null. 클라이언트는 이 값만 보고 더 부를지 정한다. */
  readonly nextCursor: Cursor | null;
}

/** 요청된 limit을 허용 범위로 자른다. 상한이 없으면 목록 하나로 DB를 태울 수 있다. */
export function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_PAGE_SIZE;
  const floored = Math.floor(limit);
  if (floored < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(floored, MAX_PAGE_SIZE);
}

export function emptyPage<T>(): Page<T> {
  return { items: [], nextCursor: null };
}
