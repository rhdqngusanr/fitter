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

/**
 * 에러 트래킹 DSN. **선택이다** — 없으면 Sentry를 켜지 않는다.
 *
 * 위의 둘과 달리 검증하지 않고 그대로 넘긴다. DSN 이 틀렸다는 이유로 화면이 안 뜨면
 * 트래킹을 붙인 대가로 서비스를 잃는 셈이다. 에러 수집은 실패해도 조용해야 한다.
 *
 * 브라우저 번들에 박히지만 비밀이 아니다 — DSN 은 이벤트를 받는 주소일 뿐이고
 * 이걸로 조회할 수 있는 건 없다.
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';

/**
 * 검색엔진 색인을 허용할지.
 *
 * **기본값이 "막는다"이고 켜려면 명시해야 한다.** 반대로 만들면 환경변수를 빠뜨린
 * 배포가 곧 색인 허용이 되는데, 색인은 되돌리기가 비대칭이다 — 거는 건 한 줄이지만
 * 잘못 걸린 걸 지우는 건 검색엔진 캐시가 빠질 때까지 기다리는 일이다.
 *
 * 친구 테스트 단계에서는 테스트 의뢰·연습용 포트폴리오가 검색에 잡히면 곤란하다.
 * 실제로 공개할 때 `NEXT_PUBLIC_ALLOW_INDEXING=true` 를 넣으면 (public) 그룹만 열린다.
 * (app) 그룹은 이 값과 무관하게 항상 noindex 다 — 의뢰 사진 저작권 때문이다.
 *
 * 근거: brain/70-산출물/배포 준비 상태.md — "색인을 허용할 것인가"
 */
export const ALLOW_INDEXING = process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true';
