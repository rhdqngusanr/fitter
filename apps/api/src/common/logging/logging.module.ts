import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { ENV, type Env } from '../../config/env';

/**
 * 구조화 로깅과 요청 ID 추적.
 *
 * 로그는 사람이 읽는 문장이 아니라 기계가 거르는 JSON이다.
 * 요청 하나가 남기는 모든 줄에 같은 requestId가 붙어야 사고가 났을 때 흐름을 복원할 수 있다.
 *
 * redact가 중요하다. **연락처는 로그에도 남기지 않는다.**
 * 응답에서 막아놓고 로그로 새면 막은 게 아니다.
 *
 * 근거: brain/30-설계/권한 모델.md
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        pinoHttp: {
          level: env.LOG_LEVEL,
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const header = req.headers['x-request-id'];
            const id = typeof header === 'string' && header.length > 0 ? header : randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.phone',
              'res.headers["set-cookie"]',
              '*.phone',
            ],
            censor: '[redacted]',
          },
          transport:
            env.NODE_ENV === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
  ],
})
export class LoggingModule {}
