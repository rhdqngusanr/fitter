/**
 * 웹의 환경변수 진입점.
 *
 * **`process.env` 를 읽는 유일한 곳이다.** api 의 `config/env.ts` 와 같은 원칙이고,
 * 파일이 둘로 나뉜 이유는 하나다 — Next 는 `process.env.NEXT_PUBLIC_X` 라는 **문자열을
 * 빌드 시점에 값으로 치환**한다. 다른 패키지의 함수로 감싸면 치환할 대상이 사라져
 * 클라이언트 번들에서 `undefined` 가 된다. 그래서 리터럴은 여기 남아 있어야 한다.
 *
 * 값은 모듈 로드 시점에 검증한다. 잘못된 URL이 화면 절반을 그린 뒤에 터지는 것보다
 * 시작할 때 터지는 편이 낫다.
 */

function requireUrl(name: string, raw: string): string {
  try {
    new URL(raw);
  } catch {
    throw new Error(`${name} 가 올바른 URL이 아닙니다: ${raw}`);
  }
  /* 끝의 슬래시를 여기서 한 번만 정리한다. 부르는 쪽마다 신경 쓰지 않게. */
  return raw.replace(/\/+$/, '');
}

/** API 서버 주소. 개발은 로컬, 운영은 배포 도메인. */
export const API_BASE_URL = requireUrl(
  'NEXT_PUBLIC_API_URL',
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
);

/**
 * 이미지 공개 베이스.
 *
 * 개발은 MinIO 버킷, 운영은 Cloudflare R2 공개 도메인이다.
 * 스토리지 키에 이걸 붙여 URL을 만든다 — 목록에서 서명 요청을 N번 하지 않기 위해서다.
 */
export const IMAGE_BASE_URL = requireUrl(
  'NEXT_PUBLIC_IMAGE_BASE_URL',
  process.env.NEXT_PUBLIC_IMAGE_BASE_URL ?? 'http://localhost:9000/fitter-images',
);
