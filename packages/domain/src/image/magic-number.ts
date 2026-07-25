/**
 * 매직 넘버로 실제 파일 타입을 판별한다.
 *
 * **확장자를 믿지 않는다.** 클라이언트 검증은 우회할 수 있으므로 서버가 진짜 방어선이고,
 * `.jpg`로 이름만 바꾼 실행 파일은 여기서 걸러진다.
 * `Content-Type` 헤더도 클라이언트가 정하는 값이라 믿을 수 없다.
 *
 * 라이브러리를 쓰지 않은 이유는 셋이다. 우리가 받는 형식이 넷뿐이고,
 * 도메인에 의존성을 들이지 않으며, 무엇보다 **판별 근거가 코드에 보여야** 하기 때문이다.
 *
 * 근거: brain/20-도메인/이미지 파이프라인.md — "확장자를 믿지 않고 매직 넘버로 확인한다"
 */

export type DetectedImageType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';

/** 판별에 필요한 최소 바이트. 앞부분만 받아도 충분하다. */
export const MAGIC_NUMBER_PROBE_BYTES = 32;

export function detectImageType(bytes: Uint8Array): DetectedImageType | null {
  if (bytes.length < 12) return null;

  /* JPEG: FF D8 FF */
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  /* PNG: 89 50 4E 47 0D 0A 1A 0A */
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }

  /* WebP: "RIFF" + 4바이트 길이 + "WEBP" */
  if (matchesAscii(bytes, 0, 'RIFF') && matchesAscii(bytes, 8, 'WEBP')) {
    return 'image/webp';
  }

  /*
   * HEIC: ISO base media 컨테이너다. offset 4에 "ftyp"이 오고
   * 그 뒤 브랜드가 heic/heix/hevc/hevx/mif1/msf1 중 하나다.
   * 아이폰 기본 형식이라 반드시 받아야 한다.
   */
  if (matchesAscii(bytes, 4, 'ftyp')) {
    const brand = asciiAt(bytes, 8, 4);
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) {
      return 'image/heic';
    }
  }

  return null;
}

/**
 * 선언한 타입과 실제 바이트가 일치하는가.
 *
 * JPEG를 PNG라고 신고하는 건 악의가 아닐 수도 있지만, 그 값을 그대로 믿고
 * 저장하면 나중에 썸네일 파생이 엉뚱한 곳에서 깨진다.
 */
export function matchesDeclaredType(bytes: Uint8Array, declared: string): boolean {
  const detected = detectImageType(bytes);
  if (!detected) return false;
  if (detected === declared) return true;
  /* image/jpg 로 보내는 클라이언트가 흔하다. 이것만 관용한다. */
  return detected === 'image/jpeg' && declared === 'image/jpg';
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

function matchesAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  return asciiAt(bytes, offset, text.length) === text;
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) return '';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += String.fromCharCode(bytes[offset + i] ?? 0);
  }
  return out;
}
