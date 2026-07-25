import { ValidationError } from '../shared/errors';

/**
 * 이미지 업로드 규칙.
 *
 * 사진이 제품의 전부인 서비스라 여기가 곧 품질이다.
 * 규칙을 도메인에 두는 이유는 **클라이언트와 서버가 같은 규칙을 봐야** 하기 때문이다.
 * 두 곳에 따로 쓰면 반드시 어긋나고, 어긋나는 순간 사용자는 "올렸는데 실패했다"를 겪는다.
 *
 * 근거: brain/20-도메인/이미지 파이프라인.md
 */

/** 용도. 개수 한도가 다르다. */
export type ImageNamespace = 'REFERENCE' | 'PORTFOLIO';

export interface ImageLimits {
  readonly maxBytes: number;
  readonly maxCount: number;
  readonly allowedMimeTypes: readonly string[];
}

/**
 * 상수의 정본은 @fitter/shared 다.
 * 도메인은 프레임워크뿐 아니라 다른 패키지도 모르는 게 원칙이라 값을 주입받는다.
 */
export function assertWithinLimits(
  input: { contentType: string; contentLength: number; currentCount: number },
  limits: ImageLimits,
): void {
  if (!limits.allowedMimeTypes.includes(input.contentType)) {
    throw new ValidationError('지원하지 않는 이미지 형식입니다.', {
      contentType: input.contentType,
    });
  }
  if (!Number.isFinite(input.contentLength) || input.contentLength <= 0) {
    throw new ValidationError('파일 크기를 확인할 수 없습니다.');
  }
  if (input.contentLength > limits.maxBytes) {
    throw new ValidationError(
      `사진은 장당 ${Math.floor(limits.maxBytes / 1024 / 1024)}MB까지 올릴 수 있습니다.`,
      { contentLength: input.contentLength },
    );
  }
  if (input.currentCount >= limits.maxCount) {
    throw new ValidationError(`사진은 최대 ${limits.maxCount}장까지 올릴 수 있습니다.`, {
      currentCount: input.currentCount,
    });
  }
}

/**
 * 의뢰 사진의 출처.
 *
 * 이 서비스의 핵심 기능이 곧 저작권 리스크다. 고객이 올리는 사진 대부분은
 * 인터넷에서 가져온 남의 저작물이라, 출처를 **사진마다** 구조적으로 받는다.
 * 전역 동의 체크박스 하나로는 나중에 어느 사진이 문제인지 되짚을 수 없다.
 *
 * 근거: brain/10-제품/리스크 - 레퍼런스 사진 저작권.md
 */
export function assertValidSource(input: {
  sourceType: 'SELF' | 'EXTERNAL';
  sourceUrl?: string | null;
}): void {
  if (input.sourceType === 'SELF') {
    if (input.sourceUrl) {
      throw new ValidationError('본인 촬영 사진에는 출처 URL을 넣지 않습니다.');
    }
    return;
  }

  const url = input.sourceUrl?.trim();
  if (!url) {
    throw new ValidationError('외부에서 가져온 사진은 출처 URL이 필요합니다.');
  }
  if (url.length > 2048) {
    throw new ValidationError('출처 URL이 너무 깁니다.');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError('출처 URL 형식이 올바르지 않습니다.', { sourceUrl: url });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError('출처 URL은 http 또는 https여야 합니다.');
  }
  /*
   * 링크가 살아 있는지는 검증하지 않는다. 그건 우리 책임 범위 밖이고,
   * 외부 요청을 서버가 대신 보내면 SSRF 표면이 생긴다.
   */
}

/** 스토리지 키. 날짜로 갈라두면 나중에 수명 정책과 정리 배치가 쉬워진다. */
export function buildStorageKey(input: {
  namespace: ImageNamespace;
  yyyymm: string;
  uuid: string;
  extension: string;
}): string {
  const prefix = input.namespace === 'REFERENCE' ? 'reference' : 'portfolio';
  return `${prefix}/${input.yyyymm}/${input.uuid}.${input.extension}`;
}

export function thumbnailKey(storageKey: string, width: number): string {
  const dot = storageKey.lastIndexOf('.');
  const base = dot === -1 ? storageKey : storageKey.slice(0, dot);
  /* 파생본은 항상 webp다. 원본 형식이 무엇이든 목록 전송량이 가장 작다. */
  return `${base}_${width}.webp`;
}
