import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';

/**
 * P4-5 탐색·필터.
 *
 * 특히 확인하는 것은 **빈 상태를 두 갈래로 나누는 신호**다.
 * "필터 때문에 0건"과 "서비스에 아직 아무것도 없어서 0건"은 완전히 다른 화면인데,
 * 시안에서 이 둘이 섞여 있었다(시안 검수 6·7번).
 */
describe('탐색과 필터 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let proToken: string;
  let customerToken: string;

  const suffix = randomUUID().slice(0, 8);
  const pro = { email: `dx-p-${suffix}@test.local`, password: 'test-password-1234' };
  const customer = { email: `dx-c-${suffix}@test.local`, password: 'test-password-1234' };

  const jpeg = (): Buffer => {
    const b = Buffer.alloc(512);
    b[0] = 0xff;
    b[1] = 0xd8;
    b[2] = 0xff;
    b[3] = 0xe0;
    return b;
  };

  const signUp = async (creds: typeof pro, role: 'CUSTOMER' | 'PRO') => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ ...creds, nickname: 'T', agreedToTerms: true })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/me/profile')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .send({ type: role })
      .expect(201);
    if (role === 'PRO') {
      const profile = await prisma.userProfile.findFirst({
        where: { userId: res.body.user.id, type: 'PRO' },
        select: { id: true },
      });
      await prisma.proProfile.update({
        where: { userProfileId: profile!.id },
        data: { isApproved: true, businessName: '김도배' },
      });
    }
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(creds)
      .expect(200);
    return login.body.accessToken as string;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);

    proToken = await signUp(pro, 'PRO');
    customerToken = await signUp(customer, 'CUSTOMER');

    /* 도배 의뢰 하나를 성북구에 공개해 둔다. */
    const created = await request(app.getHttpServer())
      .post('/api/reference-requests')
      .set({ Authorization: `Bearer ${customerToken}` })
      .expect(201);
    const id = created.body.id as string;

    await request(app.getHttpServer())
      .patch(`/api/reference-requests/${id}`)
      .set({ Authorization: `Bearer ${customerToken}` })
      .send({
        title: '성북구 24평 도배',
        areaPyeong: 24,
        housingType: 'APARTMENT',
        regionCode: '11290',
        workCategoryCodes: ['WALLPAPER'],
      })
      .expect(200);

    const presigned = await request(app.getHttpServer())
      .post('/api/images/presign')
      .set({ Authorization: `Bearer ${customerToken}` })
      .send({ namespace: 'REFERENCE', contentType: 'image/jpeg', contentLength: 512 })
      .expect(201);
    await fetch(presigned.body.url, {
      method: 'PUT',
      body: jpeg(),
      headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '512' },
    });
    await request(app.getHttpServer())
      .post(`/api/reference-requests/${id}/images`)
      .set({ Authorization: `Bearer ${customerToken}` })
      .send({ storageKey: presigned.body.storageKey, sourceType: 'SELF' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/reference-requests/${id}/publish`)
      .set({ Authorization: `Bearer ${customerToken}` })
      .expect(200);
  });

  afterAll(async () => {
    await prisma?.referenceRequest.deleteMany({
      where: { customer: { email: { in: [pro.email, customer.email] } } },
    });
    await prisma?.portfolioItem.deleteMany({
      where: { pro: { email: { in: [pro.email, customer.email] } } },
    });
    await prisma?.user.deleteMany({ where: { email: { in: [pro.email, customer.email] } } });
    await app?.close();
  });

  const server = () => app.getHttpServer();
  const asPro = (): Record<string, string> => ({ Authorization: `Bearer ${proToken}` });

  describe('시공자의 의뢰 탐색', () => {
    it('고객은 이 목록을 볼 수 없다', async () => {
      await request(server())
        .get('/api/reference-requests')
        .set({ Authorization: `Bearer ${customerToken}` })
        .expect(403);
    });

    it('공개된 의뢰가 보인다', async () => {
      const res = await request(server()).get('/api/reference-requests').set(asPro()).expect(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      /* 제안 경쟁 정도를 판단할 근거가 실린다. */
      expect(res.body.items[0]).toHaveProperty('contactCount');
      /* 목록에 원본 키는 없다. */
      expect(res.body.items[0]).not.toHaveProperty('storageKey');
    });

    it('DRAFT는 목록에 새지 않는다 — 미완성 의뢰에 제안이 들어가면 안 된다', async () => {
      const draft = await request(server())
        .post('/api/reference-requests')
        .set({ Authorization: `Bearer ${customerToken}` })
        .expect(201);

      const res = await request(server())
        .get('/api/reference-requests?limit=50')
        .set(asPro())
        .expect(200);
      const leaked = res.body.items.find((i: { id: string }) => i.id === draft.body.id);
      expect(leaked).toBeUndefined();
    });

    it('공종으로 좁힌다', async () => {
      const hit = await request(server())
        .get('/api/reference-requests?categories=WALLPAPER')
        .set(asPro())
        .expect(200);
      expect(hit.body.items.length).toBeGreaterThan(0);

      const miss = await request(server())
        .get('/api/reference-requests?categories=GROUTING')
        .set(asPro())
        .expect(200);
      expect(miss.body.items).toHaveLength(0);
    });

    it('복수 공종은 OR다 — AND면 초기에 거의 항상 0건이 된다', async () => {
      const res = await request(server())
        .get('/api/reference-requests?categories=WALLPAPER,GROUTING')
        .set(asPro())
        .expect(200);
      expect(res.body.items.length).toBeGreaterThan(0);
    });

    it('지역으로 좁힌다', async () => {
      const miss = await request(server())
        .get('/api/reference-requests?regions=11350')
        .set(asPro())
        .expect(200);
      expect(miss.body.items).toHaveLength(0);
    });
  });

  describe('빈 상태를 두 갈래로 나눈다', () => {
    it('필터 때문에 0건이면 hasAnyContent 가 true다 — 조건을 넓히라고 안내한다', async () => {
      const res = await request(server())
        .get('/api/reference-requests?regions=11350')
        .set(asPro())
        .expect(200);
      expect(res.body.items).toHaveLength(0);
      expect(res.body.hasAnyContent).toBe(true);
    });

    it('결과가 있으면 굳이 다시 세지 않는다', async () => {
      const res = await request(server()).get('/api/reference-requests').set(asPro()).expect(200);
      expect(res.body.hasAnyContent).toBe(true);
    });
  });

  describe('갤러리 필터', () => {
    it('비로그인도 필터를 쓸 수 있다', async () => {
      const res = await request(server()).get('/api/portfolios?categories=WALLPAPER').expect(200);
      expect(res.body).toHaveProperty('hasAnyContent');
      expect(res.body).toHaveProperty('nextCursor');
    });

    it('정렬을 바꿀 수 있다', async () => {
      await request(server()).get('/api/portfolios?sort=popular').expect(200);
    });

    it('유효하지 않은 정렬 값은 거부한다', async () => {
      await request(server()).get('/api/portfolios?sort=random').expect(400);
    });

    it('없는 공종 코드로 필터하면 0건이지 에러가 아니다', async () => {
      const res = await request(server()).get('/api/portfolios?categories=NOPE').expect(200);
      expect(res.body.items).toHaveLength(0);
    });
  });
});
