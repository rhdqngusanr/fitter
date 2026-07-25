import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { AppModule } from '../src/app.module';

/**
 * 통합 테스트 예시.
 *
 * 단위 테스트와 달리 여기서는 앱을 실제로 띄운다.
 * 환경변수 검증, DI 배선, 전역 필터, 라우팅이 전부 맞아야 통과한다.
 * 뼈대가 실제로 동작한다는 것을 이 테스트 하나로 확인한다.
 */
describe('헬스체크 (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/health 가 ok를 반환한다', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body).toEqual({ status: 'ok', service: 'fitter-api' });
  });

  it('모든 응답에 요청 ID가 실린다', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('없는 경로는 404를 준다 — 전역 예외 필터가 형식을 통일한다', async () => {
    const response = await request(app.getHttpServer()).get('/api/없는경로').expect(404);
    expect(response.body).toHaveProperty('code');
  });
});
