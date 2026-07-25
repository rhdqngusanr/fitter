import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';

/**
 * P4-4 완료 조건 + P4-1이 미뤄둔 조건 검증.
 *
 * "미승인 PRO가 포트폴리오를 공개하려 하면 403"
 * 그리고 **공개 조건이 두 개**라는 것 — PUBLISHED 이고 시공자가 승인됨.
 * 하나만 보고 공개하는 실수가 나기 쉬워서 목록과 상세 양쪽을 확인한다.
 */
describe('포트폴리오 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let proToken: string;
  let proUserId: string;
  let customerToken: string;

  const suffix = randomUUID().slice(0, 8);
  const pro = { email: `pf-p-${suffix}@test.local`, password: 'test-password-1234' };
  const customer = { email: `pf-c-${suffix}@test.local`, password: 'test-password-1234' };

  const jpeg = (): Buffer => {
    const buf = Buffer.alloc(512);
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
    buf[3] = 0xe0;
    return buf;
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
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(creds)
      .expect(200);
    return { token: login.body.accessToken as string, userId: res.body.user.id as string };
  };

  /** 관리자 승인 화면은 백로그라 DB로 직접 승인한다. */
  const approvePro = async (userId: string, approved: boolean) => {
    const profile = await prisma.userProfile.findFirst({
      where: { userId, type: 'PRO' },
      select: { id: true },
    });
    await prisma.proProfile.update({
      where: { userProfileId: profile!.id },
      data: { isApproved: approved, approvedAt: approved ? new Date() : null },
    });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);

    const p = await signUp(pro, 'PRO');
    proToken = p.token;
    proUserId = p.userId;
    customerToken = (await signUp(customer, 'CUSTOMER')).token;
  });

  afterAll(async () => {
    await prisma?.portfolioItem.deleteMany({
      where: { pro: { email: { in: [pro.email, customer.email] } } },
    });
    await prisma?.user.deleteMany({ where: { email: { in: [pro.email, customer.email] } } });
    await app?.close();
  });

  const server = () => app.getHttpServer();
  const auth = (t = proToken) => ({ Authorization: `Bearer ${t}` });

  /** 공개 가능한 상태까지 채운 포트폴리오를 만든다. */
  const readyPortfolio = async (): Promise<string> => {
    const created = await request(server()).post('/api/portfolios').set(auth()).expect(201);
    const id = created.body.id as string;

    await request(server())
      .patch(`/api/portfolios/${id}`)
      .set(auth())
      .send({
        title: '성북구 24평 도배',
        areaPyeong: 24,
        regionCode: '11290',
        workCategoryCodes: ['WALLPAPER'],
        workDays: 3,
      })
      .expect(200);

    const presigned = await request(server())
      .post('/api/images/presign')
      .set(auth())
      .send({ namespace: 'PORTFOLIO', contentType: 'image/jpeg', contentLength: 512 })
      .expect(201);
    await fetch(presigned.body.url, {
      method: 'PUT',
      body: jpeg(),
      headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '512' },
    });
    await request(server())
      .post(`/api/portfolios/${id}/images`)
      .set(auth())
      .send({ storageKey: presigned.body.storageKey, phase: 'AFTER' })
      .expect(201);

    return id;
  };

  describe('역할', () => {
    it('고객은 포트폴리오를 만들 수 없다', async () => {
      await request(server()).post('/api/portfolios').set(auth(customerToken)).expect(403);
    });

    it('갤러리는 비로그인에게 열려 있다 — 콜드스타트를 뚫을 유일한 유입 통로다', async () => {
      await request(server()).get('/api/portfolios').expect(200);
    });
  });

  describe('미승인 시공자', () => {
    it('프로필과 포트폴리오는 승인 전에도 쓸 수 있다', async () => {
      await request(server())
        .put('/api/me/pro-profile')
        .set(auth())
        .send({ businessName: '김도배', careerYears: 11, workCategoryCodes: ['WALLPAPER'] })
        .expect(200);

      const profile = await request(server()).get('/api/me/pro-profile').set(auth()).expect(200);
      expect(profile.body.businessName).toBe('김도배');
      expect(profile.body.isApproved).toBe(false);
    });

    it('공개하려 하면 403이다 — P4-1이 미뤄둔 완료 조건', async () => {
      const id = await readyPortfolio();
      const res = await request(server())
        .post(`/api/portfolios/${id}/publish`)
        .set(auth())
        .expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  describe('승인 이후', () => {
    let publishedId: string;

    beforeAll(async () => {
      await approvePro(proUserId, true);
      publishedId = await readyPortfolio();
      await request(server())
        .post(`/api/portfolios/${publishedId}/publish`)
        .set(auth())
        .expect(200);
    });

    it('공개된 항목이 갤러리에 뜬다', async () => {
      const res = await request(server()).get('/api/portfolios?limit=50').expect(200);
      const found = res.body.items.find((i: { id: string }) => i.id === publishedId);
      expect(found).toBeDefined();
      /* 카드에 신뢰 근거가 실린다 — 시안 검수 10번이 지적한 지점이다. */
      expect(found.pro.isApproved).toBe(true);
      expect(found.pro).toHaveProperty('careerYears');
      /* 목록은 썸네일 키만. 원본 키는 없다. */
      expect(found).not.toHaveProperty('storageKey');
    });

    /*
     * 상세는 컨택 직전 화면이라 "누가 했는가"가 여기서 끝나야 한다.
     * 그런데 연락처는 여전히 나오면 안 된다 — 컨택이 ACCEPTED가 되기 전까지는.
     * 신뢰 근거를 늘리면서 연락처를 막는 두 요구가 충돌하는 유일한 지점이다.
     */
    it('상세에 시공자 정보가 실리되 연락처는 없다', async () => {
      const res = await request(server()).get(`/api/portfolios/${publishedId}`).expect(200);

      expect(res.body.pro.businessName).toBeTruthy();
      expect(res.body.pro).toHaveProperty('careerYears');
      expect(res.body.pro).toHaveProperty('serviceAreas');

      /* 응답 어디에도 phone 키가 없어야 한다. 중첩 깊이와 무관하게. */
      expect(JSON.stringify(res.body)).not.toContain('"phone"');
    });

    it('승인이 철회되면 즉시 갤러리에서 사라진다 — 공개 조건은 두 개다', async () => {
      await approvePro(proUserId, false);

      const res = await request(server()).get('/api/portfolios?limit=50').expect(200);
      const found = res.body.items.find((i: { id: string }) => i.id === publishedId);
      expect(found).toBeUndefined();

      /* 비로그인 상세도 막힌다. 항목 status는 여전히 PUBLISHED인데도. */
      await request(server()).get(`/api/portfolios/${publishedId}`).expect(404);

      /* 소유자는 여전히 볼 수 있다. */
      await request(server()).get(`/api/portfolios/${publishedId}`).set(auth()).expect(200);

      await approvePro(proUserId, true);
    });
  });

  describe('비용 공개', () => {
    it('공개하지 않으면 금액을 저장하지 않는다', async () => {
      const created = await request(server()).post('/api/portfolios').set(auth()).expect(201);
      await request(server())
        .patch(`/api/portfolios/${created.body.id}`)
        .set(auth())
        .send({ isCostPublic: false, actualCost: 3_000_000 })
        .expect(400);
    });

    it('공개하면 금액이 함께 저장되고 응답에 실린다', async () => {
      const created = await request(server()).post('/api/portfolios').set(auth()).expect(201);
      const res = await request(server())
        .patch(`/api/portfolios/${created.body.id}`)
        .set(auth())
        .send({ isCostPublic: true, actualCost: 3_000_000, areaPyeong: 24 })
        .expect(200);
      expect(res.body.actualCost).toBe(3_000_000);
    });

    it('공개하지 않은 항목의 응답에는 금액 키 자체가 없다', async () => {
      const created = await request(server()).post('/api/portfolios').set(auth()).expect(201);
      const res = await request(server())
        .get(`/api/portfolios/${created.body.id}`)
        .set(auth())
        .expect(200);
      expect(res.body.actualCost).toBeUndefined();
    });
  });

  describe('소유권', () => {
    it('남의 포트폴리오는 수정할 수 없다', async () => {
      const id = await readyPortfolio();
      await request(server())
        .patch(`/api/portfolios/${id}`)
        .set(auth(customerToken))
        .send({ title: '가로채기' })
        .expect(403);
    });
  });
});
