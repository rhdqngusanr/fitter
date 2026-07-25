import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { ENV, type Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  /* Nest 기본 로거를 pino로 갈아 끼운다. 부팅 로그까지 구조화된다. */
  app.useLogger(app.get(Logger));

  const env = app.get<Env>(ENV);

  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.setGlobalPrefix('api');
  /* 클라이언트가 붙어 있는 채로 배포가 갈리지 않도록 종료 훅을 연다. */
  app.enableShutdownHooks();

  await app.listen(env.PORT);
}

void bootstrap();
