import { describe, expect, it } from '@jest/globals';

import { detectImageType, matchesDeclaredType } from './magic-number';

/** 실제 파일 헤더 바이트. 뒤는 0으로 채워도 판별에는 영향이 없다. */
const header = (...bytes: number[]): Uint8Array => {
  const buf = new Uint8Array(32);
  bytes.forEach((b, i) => (buf[i] = b));
  return buf;
};
const ascii = (offset: number, text: string, base: Uint8Array = new Uint8Array(32)): Uint8Array => {
  for (let i = 0; i < text.length; i += 1) base[offset + i] = text.charCodeAt(i);
  return base;
};

describe('매직 넘버 판별 — 확장자를 믿지 않는다', () => {
  it('JPEG를 알아본다', () => {
    expect(detectImageType(header(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
  });

  it('PNG를 알아본다', () => {
    expect(detectImageType(header(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(
      'image/png',
    );
  });

  it('WebP를 알아본다 — RIFF 컨테이너 안의 WEBP', () => {
    const bytes = ascii(8, 'WEBP', ascii(0, 'RIFF'));
    expect(detectImageType(bytes)).toBe('image/webp');
  });

  it('HEIC를 알아본다 — 아이폰 기본 형식이라 반드시 받아야 한다', () => {
    const bytes = ascii(8, 'heic', ascii(4, 'ftyp'));
    expect(detectImageType(bytes)).toBe('image/heic');
  });

  it('RIFF지만 WEBP가 아니면 거부한다 — WAV 같은 것', () => {
    const bytes = ascii(8, 'WAVE', ascii(0, 'RIFF'));
    expect(detectImageType(bytes)).toBeNull();
  });

  describe('확장자 위조', () => {
    it('실행 파일을 jpg로 위장해도 걸린다', () => {
      /* MZ — Windows PE 헤더 */
      const disguised = header(0x4d, 0x5a, 0x90, 0x00);
      expect(detectImageType(disguised)).toBeNull();
      expect(matchesDeclaredType(disguised, 'image/jpeg')).toBe(false);
    });

    it('선언한 타입과 실제 바이트가 다르면 거부한다', () => {
      const jpeg = header(0xff, 0xd8, 0xff, 0xe0);
      expect(matchesDeclaredType(jpeg, 'image/png')).toBe(false);
      expect(matchesDeclaredType(jpeg, 'image/jpeg')).toBe(true);
    });

    it('image/jpg 는 관용한다 — 그렇게 보내는 클라이언트가 흔하다', () => {
      expect(matchesDeclaredType(header(0xff, 0xd8, 0xff), 'image/jpg')).toBe(true);
    });
  });

  it('너무 짧은 입력은 판별하지 않는다', () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});
