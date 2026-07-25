import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { ContactsService } from '../src/modules/contacts/contacts.service';

/**
 * P4-6 완료 조건 검증.
 *
 * 가장 중요한 것은 US-042다 —
 * **ACCEPTED 이전에는 어떤 응답에도 `phone` 키가 존재하지 않는다.**
 * 마스킹된 값이 들어 있는지가 아니라 키 자체가 없는지를 본다.
 */
describe('컨택 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let contacts: ContactsService;

  const suffix = randomUUID().slice(0, 8);
  const customer = { email: `ct-c-${suffix}@test.local`, password: 'test-password-1234' };
  const pro = { email: `ct-p-${suffix}@test.local`, password: 'test-password-1234' };
  const other = { email: `ct-o-${suffix}@test.local`, password: 'test-password-1234' };

  let customerToken: string;
  let proToken: string;
  let otherToken: string;
  let requestId: string;

  const jpeg = (): Buffer => {
    const b = Buffer.alloc(512);
    b[0] = 0xff;
    b[1] = 0xd8;
    b[2] = 0xff;
    b[3] = 0xe0;
    return b;
  };

  const signUp = async (creds: typeof pro, role: 'CUSTOMER' | 'PRO', approve = false) => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ ...creds, nickname: 'T', agreedToTerms: true })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/me/profile')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .send({ type: role })
      .expect(201);
    /* 연락처를 넣어둬야 "새는지"를 확인할 수 있다. */
    await prisma.user.update({
      where: { id: res.body.user.id },
      data: { phone: '010-4821-9930' },
    });
    if (approve) {
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
    contacts = app.get(ContactsService);

    customerToken = await signUp(customer, 'CUSTOMER');
    proToken = await signUp(pro, 'PRO', true);
    otherToken = await signUp(other, 'CUSTOMER');

    /* 제안 대상이 될 의뢰 하나를 공개해 둔다. */
    const created = await request(app.getHttpServer())
      .post('/api/reference-requests')
      .set({ Authorization: `Bearer ${customerToken}` })
      .expect(201);
    requestId = created.body.id;

    await request(app.getHttpServer())
      .patch(`/api/reference-requests/${requestId}`)
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
      .post(`/api/reference-requests/${requestId}/images`)
      .set({ Authorization: `Bearer ${customerToken}` })
      .send({ storageKey: presigned.body.storageKey, sourceType: 'SELF' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/reference-requests/${requestId}/publish`)
      .set({ Authorization: `Bearer ${customerToken}` })
      .expect(200);
  });

  afterAll(async () => {
    const emails = [customer.email, pro.email, other.email];
    await prisma?.contactRequest.deleteMany({ where: { requester: { email: { in: emails } } } });
    await prisma?.referenceRequest.deleteMany({ where: { customer: { email: { in: emails } } } });
    await prisma?.user.deleteMany({ where: { email: { in: emails } } });
    await app?.close();
  });

  const server = () => app.getHttpServer();
  const asCustomer = () => ({ Authorization: `Bearer ${customerToken}` });
  const asPro = () => ({ Authorization: `Bearer ${proToken}` });
  const asOther = () => ({ Authorization: `Bearer ${otherToken}` });

  /** 시공자가 의뢰에 제안한다. 매번 새 컨택이 필요하므로 만들고 지운다. */
  const propose = async (amount?: number) => {
    await prisma.contactRequest.deleteMany({
      where: { referenceRequestId: requestId, status: 'REQUESTED' },
    });
    const res = await request(server())
      .post('/api/contacts')
      .set(asPro())
      .send({
        direction: 'PRO_TO_REQUEST',
        referenceRequestId: requestId,
        message: '거실 실크, 아이방 합지로 진행 가능합니다.',
        ...(amount ? { proposedAmount: amount } : {}),
      })
      .expect(201);
    return res.body.id as string;
  };

  describe('요청 생성', () => {
    it('시공자가 의뢰에 제안한다', async () => {
      const id = await propose(3_800_000);
      const detail = await request(server()).get(`/api/contacts/${id}`).set(asPro()).expect(200);
      expect(detail.body.status).toBe('REQUESTED');
      /* 제안 금액이 구조화되어 저장된다 — 2차 가격 통계의 1차 데이터원. */
      expect(detail.body.proposedAmount).toBe(3_800_000);
    });

    it('같은 상대에게 진행 중 요청이 있으면 거부한다', async () => {
      await propose();
      const res = await request(server())
        .post('/api/contacts')
        .set(asPro())
        .send({
          direction: 'PRO_TO_REQUEST',
          referenceRequestId: requestId,
          message: '두 번째',
        })
        .expect(409);
      expect(res.body.code).toBe('CONFLICT');
    });

    it('고객은 의뢰 방향으로 제안할 수 없다', async () => {
      await request(server())
        .post('/api/contacts')
        .set(asCustomer())
        .send({ direction: 'PRO_TO_REQUEST', referenceRequestId: requestId, message: 'x' })
        .expect(403);
    });
  });

  describe('주체 검증 — 이 상태머신의 핵심', () => {
    it('요청자가 수락하려 하면 거부한다', async () => {
      const id = await propose();
      const res = await request(server())
        .post(`/api/contacts/${id}/accept`)
        .set(asPro())
        .expect(409);
      expect(res.body.code).toBe('INVALID_TRANSITION');
    });

    it('수신자가 취소하려 하면 거부한다', async () => {
      const id = await propose();
      await request(server()).post(`/api/contacts/${id}/cancel`).set(asCustomer()).expect(409);
    });

    it('제3자는 조회조차 못 한다 — 404다', async () => {
      const id = await propose();
      await request(server()).get(`/api/contacts/${id}`).set(asOther()).expect(404);
      await request(server()).post(`/api/contacts/${id}/accept`).set(asOther()).expect(404);
    });

    it('수신자가 수락하면 통과한다', async () => {
      const id = await propose();
      const res = await request(server())
        .post(`/api/contacts/${id}/accept`)
        .set(asCustomer())
        .expect(200);
      expect(res.body.status).toBe('ACCEPTED');
    });

    it('이미 종료된 컨택은 다시 처리할 수 없다 — 경쟁 상태 방어', async () => {
      const id = await propose();
      await request(server()).post(`/api/contacts/${id}/accept`).set(asCustomer()).expect(200);
      await request(server())
        .post(`/api/contacts/${id}/decline`)
        .set(asCustomer())
        .send({})
        .expect(409);
    });
  });

  describe('연락처는 ACCEPTED일 때만 실린다 (US-042)', () => {
    it('REQUESTED 상세 응답에 phone 키가 존재하지 않는다', async () => {
      const id = await propose();
      const res = await request(server()).get(`/api/contacts/${id}`).set(asCustomer()).expect(200);

      expect(res.body.counterpart).toBeDefined();
      /* 마스킹된 값이 아니라 키 자체가 없어야 한다. */
      expect(res.body.counterpart).not.toHaveProperty('phone');
      expect(JSON.stringify(res.body)).not.toContain('010-');
    });

    it('목록 응답에는 상태와 무관하게 phone 키가 없다', async () => {
      const id = await propose();
      await request(server()).post(`/api/contacts/${id}/accept`).set(asCustomer()).expect(200);

      for (const box of ['received', 'sent']) {
        const res = await request(server())
          .get(`/api/contacts?box=${box}`)
          .set(asCustomer())
          .expect(200);
        expect(JSON.stringify(res.body)).not.toContain('010-');
      }
    });

    it('수락하면 같은 응답에서 연락처가 열린다', async () => {
      const id = await propose();
      const res = await request(server())
        .post(`/api/contacts/${id}/accept`)
        .set(asCustomer())
        .expect(200);
      expect(res.body.counterpart.phone).toBe('010-4821-9930');
    });

    it('거절로 끝난 컨택은 연락처를 열지 않는다', async () => {
      const id = await propose();
      const res = await request(server())
        .post(`/api/contacts/${id}/decline`)
        .set(asCustomer())
        .send({ reason: '예산이 안 맞습니다' })
        .expect(200);
      expect(res.body.counterpart).not.toHaveProperty('phone');
    });

    it('의뢰 상세의 어디에도 연락처가 없다', async () => {
      const res = await request(server())
        .get(`/api/reference-requests/${requestId}`)
        .set(asPro())
        .expect(200);
      expect(JSON.stringify(res.body)).not.toContain('010-');
    });

    it('본인 정보에는 연락처가 실린다 — 유일한 예외', async () => {
      const res = await request(server()).get('/api/me').set(asCustomer()).expect(200);
      expect(res.body.phone).toBe('010-4821-9930');
    });
  });

  describe('만료 배치', () => {
    it('기한이 지난 REQUESTED만 EXPIRED가 된다', async () => {
      const id = await propose();
      await prisma.contactRequest.update({
        where: { id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const count = await contacts.expireOverdue();
      expect(count).toBeGreaterThan(0);

      const after = await prisma.contactRequest.findUnique({ where: { id } });
      expect(after?.status).toBe('EXPIRED');
    });

    it('만료된 컨택은 연락처를 열지 않는다', async () => {
      const id = await propose();
      await prisma.contactRequest.update({
        where: { id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await contacts.expireOverdue();

      const res = await request(server()).get(`/api/contacts/${id}`).set(asCustomer()).expect(200);
      expect(res.body.status).toBe('EXPIRED');
      expect(res.body.counterpart).not.toHaveProperty('phone');
    });
  });
});
