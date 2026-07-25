import { describe, expect, it } from '@jest/globals';

import { ValidationError } from '../shared/errors';
import { assertValidSource, assertWithinLimits, thumbnailKey } from './image-rules';

const limits = {
  maxBytes: 10 * 1024 * 1024,
  maxCount: 10,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
};

describe('이미지 업로드 한도', () => {
  const ok = { contentType: 'image/jpeg', contentLength: 1024, currentCount: 0 };

  it('정상 입력은 통과한다', () => {
    expect(() => assertWithinLimits(ok, limits)).not.toThrow();
  });

  it('10MB를 넘으면 거부한다', () => {
    expect(() =>
      assertWithinLimits({ ...ok, contentLength: 10 * 1024 * 1024 + 1 }, limits),
    ).toThrow(ValidationError);
  });

  it('허용하지 않는 형식은 거부한다', () => {
    expect(() => assertWithinLimits({ ...ok, contentType: 'application/pdf' }, limits)).toThrow(
      ValidationError,
    );
  });

  it('개수 한도에 도달하면 거부한다', () => {
    expect(() => assertWithinLimits({ ...ok, currentCount: 10 }, limits)).toThrow(ValidationError);
  });

  it('크기를 알 수 없으면 거부한다', () => {
    expect(() => assertWithinLimits({ ...ok, contentLength: 0 }, limits)).toThrow(ValidationError);
  });
});

describe('사진 출처 (저작권 방어선)', () => {
  it('본인 촬영은 URL이 없어야 한다', () => {
    expect(() => assertValidSource({ sourceType: 'SELF' })).not.toThrow();
    expect(() => assertValidSource({ sourceType: 'SELF', sourceUrl: 'https://x.com' })).toThrow(
      ValidationError,
    );
  });

  it('외부 출처는 URL이 필수다', () => {
    expect(() => assertValidSource({ sourceType: 'EXTERNAL' })).toThrow(ValidationError);
    expect(() => assertValidSource({ sourceType: 'EXTERNAL', sourceUrl: '  ' })).toThrow(
      ValidationError,
    );
  });

  it('URL 형식을 검증한다', () => {
    expect(() => assertValidSource({ sourceType: 'EXTERNAL', sourceUrl: 'not a url' })).toThrow(
      ValidationError,
    );
  });

  it('http/https 가 아니면 거부한다 — javascript: 같은 것', () => {
    expect(() =>
      assertValidSource({ sourceType: 'EXTERNAL', sourceUrl: 'javascript:alert(1)' }),
    ).toThrow(ValidationError);
  });

  it('정상 외부 출처는 통과한다', () => {
    expect(() =>
      assertValidSource({ sourceType: 'EXTERNAL', sourceUrl: 'https://ohou.se/contents/12345' }),
    ).not.toThrow();
  });
});

describe('썸네일 키', () => {
  it('파생본은 항상 webp다 — 목록 전송량이 가장 작다', () => {
    expect(thumbnailKey('reference/2026-07/abc.jpg', 400)).toBe('reference/2026-07/abc_400.webp');
    expect(thumbnailKey('portfolio/2026-07/abc.heic', 1200)).toBe(
      'portfolio/2026-07/abc_1200.webp',
    );
  });
});
