/**
 * API 클라이언트.
 *
 * 에러 포맷이 `{ code, message, details }` 로 통일돼 있으므로
 * **분기는 상태 코드가 아니라 `code` 로 한다** — 메시지를 바꿀 때마다 화면이 깨지지 않게.
 *
 * 근거: brain/70-산출물/API 명세.md
 */

import type { HousingType, ImagePhase, MaterialGrade } from '@fitter/shared';

import { API_BASE_URL, IMAGE_BASE_URL } from './env';

/** 스토리지 키를 화면에서 쓸 URL로 바꾼다. 운영에서는 R2 공개 도메인이 된다. */
export function imageUrl(key: string | null | undefined): string | null {
  return key ? `${IMAGE_BASE_URL}/${key}` : null;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiOptions extends RequestInit {
  /** 서버 컴포넌트에서 캐시를 끄고 싶을 때. 목록은 항상 최신이어야 한다. */
  revalidate?: number | false;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { revalidate, ...init } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
    /* 리프레시 토큰이 httpOnly 쿠키라 자격증명을 함께 보낸다. */
    credentials: 'include',
    ...(revalidate === undefined ? {} : { next: { revalidate: revalidate || 0 } }),
  });

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = body as { code?: string; message?: string; details?: unknown } | null;
    throw new ApiError(
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? '요청을 처리하지 못했습니다.',
      response.status,
      error?.details,
    );
  }

  return body as T;
}

/* ── 응답 타입. API 명세와 같은 모양이다. ───────────────────────── */

export interface GalleryItem {
  id: string;
  title: string;
  areaPyeong: string | null;
  coverThumbKey: string | null;
  photoCount: number;
  isCostPublic: boolean;
  categories: { code: string; nameKo: string }[];
  region: { code: string; sigunguName: string } | null;
  pro: { id: string; businessName: string; careerYears: number; isApproved: boolean };
}

export interface GalleryResponse {
  /** 빈 상태를 두 갈래로 나누는 신호. 필터 0건과 콘텐츠 0건은 다른 화면이다. */
  hasAnyContent: boolean;
  /** 필터를 적용한 총 건수. 첫 페이지에서만 온다 — 다음 장에서는 이미 아는 숫자다. */
  totalCount?: number;
  items: GalleryItem[];
  nextCursor: string | null;
}

export interface PortfolioImage {
  id: string;
  thumb400Key: string | null;
  thumb1200Key: string | null;
  /*
   * 단계는 @fitter/shared 가 정본이다. 손으로 적었더니 PROCESS 를 PROGRESS 로
   * 잘못 써놨었다 — 서버가 절대 보내지 않는 값을 화면 타입이 기다리고 있었다.
   */
  phase: ImagePhase | null;
  isCover: boolean;
  /** 원본 비율. 자리를 미리 잡아 레이아웃 이동을 막는 데 쓴다. */
  width: number | null;
  height: number | null;
}

export interface PortfolioDetail {
  id: string;
  title: string;
  description: string | null;
  areaPyeong: string | null;
  /** ㎡는 서버가 평에서 파생한다. 파생 경로는 하나여야 한다. */
  areaM2: number | null;
  /* enum은 @fitter/shared 가 정본이다. 화면이 문자열로 받아 두면 라벨 맵과 어긋난다. */
  housingType: HousingType | null;
  materialGrade: MaterialGrade | null;
  workDays: number | null;
  workedAt: string | null;
  viewCount: number;
  isCostPublic: boolean;
  /** 공개하지 않았으면 키 자체가 없다. `null` 과 구분된다. */
  actualCost?: number;
  images: PortfolioImage[];
  categories: { code: string; nameKo: string }[];
  region: { code: string; sigunguName: string } | null;
  pro: {
    id: string;
    businessName: string;
    intro: string | null;
    careerYears: number;
    isApproved: boolean;
    serviceAreas: { code: string; sigunguName: string }[];
  };
}
