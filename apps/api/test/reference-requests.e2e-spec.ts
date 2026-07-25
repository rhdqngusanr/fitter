import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';

/**
 * P4-3 완료 조건 검증.
 *
 * "필수값 누락, 사진 0장, 잘못된 평수(0 이하, 500 초과)가 모두 차단되는 테스트"
 * 그리고 "DRAFT가 어떤 목록에도 노출되지 않는 것".
 */
describe('레퍼런스 의뢰 등록 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let proToken: string;

  const suffix = randomUUID().slice(0, 8);
  const customer = { email: `req-c-${suffix}@test.local`, password: 'test-password-1234' };
  const pro = { email: `req-p-${suffix}@test.local`, password: 'test-password-1234' };

  const jpeg = (): Buffer => {
    const buf = Buffer.alloc(512);
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
    buf[3] = 0xe0;
    return buf;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);

    const signUp = async (creds: typeof customer, role: 'CUSTOMER' | 'PRO') => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ ...creds, nickname: 'T', agreedToTerms: true })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/me/profile')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .send({ type: role })
        .expect(201);
      /* 역할이 토큰에 들어가야 하므로 다시 로그인한다. */
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(creds)
        .expect(200);
      return login.body.accessToken as string;
    };

    token = await signUp(customer, 'CUSTOMER');
    proToken = await signUp(pro, 'PRO');
  });

  afterAll(async () => {
    /*
     * users → reference_requests 는 RESTRICT 다(이력 보존).
     * 그래서 의뢰를 먼저 지워야 계정이 지워진다. 사진과 공종 연결은 CASCADE로 따라온다.
     * 실제 탈퇴 플로우도 같은 순서를 거쳐야 한다.
     */
    await prisma?.referenceRequest.deleteMany({
      where: { customer: { email: { in: [customer.email, pro.email] } } },
    });
    await prisma?.user.deleteMany({ where: { email: { in: [customer.email, pro.email] } } });
    await app?.close();
  });

  const server = () => app.getHttpServer();
  const auth = (t = token) => ({ Authorization: `Bearer ${t}` });

  const newDraft = async (): Promise<string> => {
    const res = await request(server()).post('/api/reference-requests').set(auth()).expect(201);
    return res.body.id;
  };

  /** 사진 한 장을 실제로 올려 붙인다. 서명 URL → 직접 PUT → 등록까지 전부 거친다. */
  const attachPhoto = async (
    id: string,
    source: Record<string, unknown> = { sourceType: 'SELF' },
    expectStatus = 201,
  ) => {
    const presigned = await request(server())
      .post('/api/images/presign')
      .set(auth())
      .send({ namespace: 'REFERENCE', contentType: 'image/jpeg', contentLength: 512 })
      .expect(201);

    await fetch(presigned.body.url, {
      method: 'PUT',
      body: jpeg(),
      headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '512' },
    });

    return request(server())
      .post(`/api/reference-requests/${id}/images`)
      .set(auth())
      .send({ storageKey: presigned.body.storageKey, ...source })
      .expect(expectStatus);
  };

  describe('역할', () => {
    it('시공자는 의뢰를 만들 수 없다', async () => {
      await request(server()).post('/api/reference-requests').set(auth(proToken)).expect(403);
    });

    it('비로그인은 상세를 볼 수 없다 — 의뢰는 로그인 전용이다', async () => {
      await request(server())
        .get('/api/reference-requests/' + randomUUID())
        .expect(401);
    });
  });

  describe('확장 규약', () => {
    it('평수가 0이면 거부한다', async () => {
      const id = await newDraft();
      const res = await request(server())
        .patch(`/api/reference-requests/${id}`)
        .set(auth())
        .send({ areaPyeong: 0 })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('평수가 500을 넘으면 거부한다', async () => {
      const id = await newDraft();
      await request(server())
        .patch(`/api/reference-requests/${id}`)
        .set(auth())
        .send({ areaPyeong: 501 })
        .expect(400);
    });

    it('평수를 문자열로 보내면 거부한다 — 자유 텍스트가 들어올 문이 없다', async () => {
      const id = await newDraft();
      await request(server())
        .patch(`/api/reference-requests/${id}`)
        .set(auth())
        .send({ areaPyeong: '24평쯤이요' })
        .expect(400);
    });

    it('없는 공종 코드는 조용히 버리지 않고 거부한다', async () => {
      const id = await newDraft();
      await request(server())
        .patch(`/api/reference-requests/${id}`)
        .set(auth())
        .send({ workCategoryCodes: ['WALLPAPER', '없는공종'] })
        .expect(400);
    });

    it('정상 입력은 저장되고 ㎡가 파생된다', async () => {
      const id = await newDraft();
      const res = await request(server())
        .patch(`/api/reference-requests/${id}`)
        .set(auth())
        .send({
          title: '성북구 24평 도배',
          areaPyeong: 24,
          housingType: 'APARTMENT',
          regionCode: '11290',
          workCategoryCodes: ['WALLPAPER', 'FLOORING'],
          isOccupied: true,
          floor: 12,
          hasElevator: true,
        })
        .expect(200);

      expect(res.body.areaM2).toBeCloseTo(79.34, 1);
      expect(res.body.categories).toHaveLength(2);
      expect(res.body.floor).toBe(12);
    });
  });

  describe('공개 조건', () => {
    it('사진이 0장이면 공개할 수 없다', async () => {
      const id = await newDraft();
      await request(server())
        .patch(`/api/reference-requests/${id}`)
        .set(auth())
        .send({ title: 'x', areaPyeong: 24, housingType: 'APARTMENT', regionCode: '11290' })
        .expect(200);

      const res = await request(server())
        .post(`/api/reference-requests/${id}/publish`)
        .set(auth())
        .expect(400);
      expect(res.body.details.missing).toContain('images');
    });

    it('필수값이 비면 무엇이 빠졌는지 알려준다', async () => {
      const id = await newDraft();
      await attachPhoto(id);

      const res = await request(server())
        .post(`/api/reference-requests/${id}/publish`)
        .set(auth())
        .expect(400);
      expect(res.body.details.missing).toEqual(
        expect.arrayContaining(['title', 'regionCode', 'areaPyeong']),
      );
    });

    it('외부 출처 사진에 URL이 없으면 붙일 수 없다', async () => {
      const id = await newDraft();
      const res = await attachPhoto(id, { sourceType: 'EXTERNAL' }, 400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('전부 갖추면 공개된다', async () => {
      const id = await newDraft();
      await request(server())
        .patch(`/api/reference-requests/${id}`)
        .set(auth())
        .send({
          title: '성북구 24평 도배·장판',
          areaPyeong: 24,
          housingType: 'APARTMENT',
          regionCode: '11290',
          workCategoryCodes: ['WALLPAPER'],
        })
        .expect(200);
      await attachPhoto(id, {
        sourceType: 'EXTERNAL',
        sourceUrl: 'https://ohou.se/contents/12345',
      });

      const res = await request(server())
        .post(`/api/reference-requests/${id}/publish`)
        .set(auth())
        .expect(200);
      expect(res.body.status).toBe('PUBLISHED');
      /* 첫 사진이 자동으로 대표가 된다. */
      expect(res.body.images[0].isCover).toBe(true);
    });
  });

  describe('DRAFT 노출 통제', () => {
    it('남의 DRAFT는 404다 — 403은 존재를 알려준다', async () => {
      const id = await newDraft();
      await request(server()).get(`/api/reference-requests/${id}`).set(auth(proToken)).expect(404);
    });

    it('내 목록에서는 DRAFT도 보인다 — 이어써야 하기 때문이다', async () => {
      const id = await newDraft();
      const res = await request(server()).get('/api/me/reference-requests').set(auth()).expect(200);
      const found = res.body.items.find((item: { id: string }) => item.id === id);
      expect(found).toBeDefined();
      expect(found.status).toBe('DRAFT');
    });

    it('목록은 커서 페이지네이션이고 오프셋 파라미터가 없다', async () => {
      const res = await request(server())
        .get('/api/me/reference-requests?limit=1')
        .set(auth())
        .expect(200);
      expect(res.body).toHaveProperty('nextCursor');
      expect(res.body.items).toHaveLength(1);
      /* 목록에는 400px 썸네일 키만 실린다. 원본 키는 없다. */
      expect(res.body.items[0]).not.toHaveProperty('storageKey');
    });

    it('깨진 커서는 에러가 아니라 첫 페이지다', async () => {
      await request(server())
        .get('/api/me/reference-requests?cursor=broken-cursor-value')
        .set(auth())
        .expect(200);
    });
  });

  describe('수정과 삭제', () => {
    it('남의 의뢰는 수정할 수 없다', async () => {
      const id = await newDraft();
      await request(server())
        .patch(`/api/reference-requests/${id}`)
        .set(auth(proToken))
        .send({ title: '가로채기' })
        .expect(403);
    });

    it('삭제는 soft delete 이고 이후 조회되지 않는다', async () => {
      const id = await newDraft();
      await request(server()).delete(`/api/reference-requests/${id}`).set(auth()).expect(204);
      await request(server()).get(`/api/reference-requests/${id}`).set(auth()).expect(404);

      const row = await prisma.referenceRequest.findUnique({ where: { id } });
      expect(row?.deletedAt).not.toBeNull();
    });
  });
});
