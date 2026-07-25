/**
 * API 클라이언트.
 *
 * 에러 포맷이 `{ code, message, details }` 로 통일돼 있으므로
 * **분기는 상태 코드가 아니라 `code` 로 한다** — 메시지를 바꿀 때마다 화면이 깨지지 않게.
 *
 * 근거: brain/70-산출물/API 명세.md
 */

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
  items: GalleryItem[];
  nextCursor: string | null;
}
