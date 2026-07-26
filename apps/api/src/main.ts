/*
 * **이 줄이 맨 위여야 한다.** Sentry 가 라이브러리를 감싸 계측하려면 그 라이브러리보다
 * 먼저 로드돼야 한다. 이 파일이 .env 로드까지 겸한다 — 이유는 instrument.ts 주석에 있다.
 * 운영에서는 .env가 없고 플랫폼이 주입한 환경변수를 그대로 쓴다 — dotenv는 조용히 넘어간다.
 */
import './instrument';
import 'reflect-metadata';

import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { ENV, type Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  /* Nest 기본 로거를 pino로 갈아 끼운다. 부팅 로그까지 구조화된다. */
  app.useLogger(app.get(Logger));

  const env = app.get<Env>(ENV);

  /* 리프레시 토큰이 httpOnly 쿠키로 오간다. */
  app.use(cookieParser());
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.setGlobalPrefix('api');
  /* 클라이언트가 붙어 있는 채로 배포가 갈리지 않도록 종료 훅을 연다. */
  app.enableShutdownHooks();

  await app.listen(env.PORT);
}

void bootstrap();
