/*
 * Sentry 초기화.
 *
 * **main.ts 의 가장 첫 import 여야 한다.** Sentry 는 http·pg·redis 같은 라이브러리를
 * 로드 시점에 감싸서 계측하는데, 그 라이브러리들이 먼저 import 되면 감쌀 대상이 이미
 * 사라진 뒤다. 에러 자체는 그래도 잡히지만 "터지기 직전에 무슨 쿼리가 나갔나"가 통째로
 * 비어서, 정작 필요할 때 아무것도 알려주지 않는 트래킹이 된다.
 *
 * 그래서 이 파일만 예외적으로 부팅 순서를 앞선다. dotenv 도 여기서 먼저 읽는다 —
 * main.ts 의 `dotenv/config` 보다 앞서 실행되므로 여기서 안 읽으면 DSN 이 비어 보인다.
 * 운영에서는 .env 가 없고 플랫폼이 주입한 값을 그대로 쓴다.
 *
 * 근거: brain/70-산출물/배포 준비 상태.md — "에러 트래킹 없음. 친구 테스트에서는
 * 이게 있어야 무슨 일이 났는지 안다"
 */
import 'dotenv/config';

import * as Sentry from '@sentry/node';

import { loadEnv } from './config/env';

/*
 * process.env 를 직접 읽지 않고 loadEnv 를 거친다. 검증 진입점은 앱마다 하나다.
 * 부수 효과로 환경변수가 잘못됐을 때 Nest 부팅보다 먼저 죽는다 — 어차피 죽을 거라면
 * 더 일찍 죽는 쪽이 낫다.
 */
const env = loadEnv();

/*
 * DSN 이 없으면 아무것도 하지 않는다. Sentry.init 을 DSN 없이 불러도 no-op 이지만
 * 명시적으로 건너뛰어야 로컬에서 "왜 안 올라가지" 하는 시간을 안 쓴다.
 */
if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,

    /*
     * 트레이싱은 끈다. 지금 필요한 건 "무엇이 터졌나"이지 "얼마나 느린가"가 아니고,
     * 무료 티어 할당량을 성능 데이터로 태우면 정작 에러가 샘플링돼 사라진다.
     * P5-2 성능 측정을 시작할 때 켜면 된다.
     */
    tracesSampleRate: 0,

    /*
     * 요청 본문을 싣지 않는다. 이 API 의 본문에는 비밀번호와 연락처가 오간다 —
     * 연락처를 응답에서 지우는 인터셉터를 두고 에러 리포트로 새어나가면 헛수고다.
     * 근거: brain/50-결정/ADR-002 - 인증과 권한 모델.md 결정 6
     */
    sendDefaultPii: false,
  });
}
