/*
 * 브라우저 쪽 계측. Next 15.3+ 규약으로, 클라이언트 번들의 가장 앞에서 실행된다.
 *
 * 여기서 잡는 건 전역 에러와 처리되지 않은 프라미스 거부다.
 * React 렌더 중에 터진 것은 에러 경계가 먼저 삼키므로 app/global-error.tsx 가 따로 올린다.
 */
import * as Sentry from '@sentry/nextjs';

import { SENTRY_DSN } from './lib/env';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0,
    sendDefaultPii: false,

    /*
     * 세션 리플레이는 켜지 않는다. 화면을 그대로 녹화하는 기능이라
     * 수락된 컨택의 연락처가 영상으로 남는다 — 응답에서 phone 키를 지운 의미가 없어진다.
     */
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

/** 라우터 전환을 계측이 따라가게 한다. Next 가 이 이름으로 찾는다. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
