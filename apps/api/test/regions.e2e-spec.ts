import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';

/**
 * 행정구역 코드 조회.
 *
 * [[확장 규약]] 3조를 화면이 지킬 수 있게 해주는 유일한 통로다.
 * 이 API가 없으면 화면은 주소를 자유 텍스트로 받는 수밖에 없다.
 */
describe('행정구역 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma?.region.deleteMany({ where: { code: '99999' } });
    await app?.close();
  });

  const server = () => app.getHttpServer();

  it('비로그인도 조회할 수 있다 — 갤러리 지역 필터가 공개 화면이다', async () => {
    const res = await request(server()).get('/api/regions').expect(200);
    expect(Array.isArray(res.body.sido)).toBe(true);
    expect(res.body.sido.length).toBeGreaterThan(0);
  });

  it('시도로 묶여서 온다 — 화면이 2단계로 고르기 때문이다', async () => {
    const res = await request(server()).get('/api/regions').expect(200);
    const seoul = res.body.sido.find((s: { name: string }) => s.name === '서울특별시');

    expect(seoul).toBeDefined();
    expect(seoul.code).toBe('11');
    /* 시군구는 코드와 이름만 있으면 된다. 시도 이름을 중복해 싣지 않는다. */
    expect(seoul.sigungu.length).toBeGreaterThan(0);
    expect(seoul.sigungu[0]).toEqual({
      code: expect.any(String) as unknown as string,
      name: expect.any(String) as unknown as string,
    });
  });

  it('시군구 코드는 5자리다 — 확장 규약 3조', async () => {
    const res = await request(server()).get('/api/regions').expect(200);
    for (const sido of res.body.sido as { sigungu: { code: string }[] }[]) {
      for (const gu of sido.sigungu) expect(gu.code).toHaveLength(5);
    }
  });

  /*
   * 서비스를 접은 지역을 지우지 않고 끄는 이유는, 그 지역 코드를 참조하는
   * 의뢰와 포트폴리오가 이미 있기 때문이다. 지우면 이력이 깨진다.
   */
  it('비활성 지역은 목록에 나오지 않는다 — 지우지 않고 끈다', async () => {
    await prisma.region.create({
      data: {
        code: '99999',
        sidoCode: '99',
        sidoName: '없는시도',
        sigunguName: '없는구',
        isActive: false,
      },
    });

    const res = await request(server()).get('/api/regions').expect(200);
    const codes = (res.body.sido as { sigungu: { code: string }[] }[]).flatMap((s) =>
      s.sigungu.map((g) => g.code),
    );
    expect(codes).not.toContain('99999');
  });
});
