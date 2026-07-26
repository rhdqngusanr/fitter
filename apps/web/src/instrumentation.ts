/*
 * 서버 쪽 계측. Next 가 서버 부팅 때 한 번 부른다.
 *
 * 클라이언트 쪽은 instrumentation-client.ts 가 따로 맡는다 — 두 런타임은 번들이
 * 달라서 한 파일로 합칠 수 없다.
 */
import * as Sentry from '@sentry/nextjs';

import { SENTRY_DSN } from './lib/env';

export function register(): void {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,

    /*
     * api 쪽과 같은 이유로 트레이싱은 끈다. 무료 티어 할당량을 성능 데이터로 태우면
     * 정작 에러가 샘플링돼 사라진다. 자세한 건 apps/api/src/instrument.ts.
     */
    tracesSampleRate: 0,

    /*
     * 의뢰 사진과 연락처가 오가는 서비스다. 요청 본문·헤더를 리포트에 싣지 않는다.
     * 근거: brain/50-결정/ADR-002 - 인증과 권한 모델.md 결정 6
     */
    sendDefaultPii: false,
  });
}

/**
 * 서버 컴포넌트·라우트 핸들러에서 터진 에러를 받는다.
 *
 * **이게 없으면 SSR 화면이 조용히 죽는다.** 갤러리·시공자 목록이 전부 SSR 이라
 * 여기서 터지면 사용자는 빈 에러 페이지만 보고 우리는 아무것도 못 본다.
 */
export const onRequestError = Sentry.captureRequestError;
