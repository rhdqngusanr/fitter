import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /* 워크스페이스 패키지를 Next 빌드 파이프라인에 태운다. */
  transpilePackages: ['@fitter/shared'],
};

/*
 * Sentry 빌드 플러그인.
 *
 * DSN 과 별개다 — DSN 은 "이벤트를 어디로 보내나"이고 여기는 "빌드 산출물을 어떻게
 * 읽을 수 있게 만드나"다. 소스맵을 올려야 압축된 스택이 원래 파일·줄로 풀린다.
 *
 * 어느 프로젝트에 올릴지는 **빌드 환경변수 세 개**로 정해진다. 여기 적지 않는 이유는
 * 값이 배포 플랫폼에 사는 게 맞고, 인증 토큰은 코드에 들어오면 안 되기 때문이다.
 *
 *   SENTRY_ORG · SENTRY_PROJECT · SENTRY_AUTH_TOKEN
 *
 * **셋이 없으면 업로드를 건너뛰고 빌드는 그대로 성공한다.** 그래서 Sentry 프로젝트를
 * 만들기 전에도 로컬 빌드가 깨지지 않는다.
 */
export default withSentryConfig(nextConfig, {
  /*
   * 올린 소스맵은 산출물에서 지운다. 남겨두면 브라우저에서 원본 코드를 그대로 받아갈 수 있다.
   */
  sourcemaps: { deleteSourcemapsAfterUpload: true },

  /* Sentry 자체 디버그 로거를 번들에서 뺀다. 운영 번들에 쓸 이유가 없다. */
  disableLogger: true,
});
