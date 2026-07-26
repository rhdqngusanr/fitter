import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';

/**
 * 의뢰가 받은 제안 목록 (C-03).
 *
 * 이 조회의 위험은 둘이다.
 *
 * 1. **남의 의뢰에 누가 제안했는지 새는 것.** 소유자가 아니면 404 다 —
 *    403 은 "그 의뢰가 존재한다"를 알려준다.
 * 2. **연락처가 실리는 것.** 수락 여부와 무관하게 이 목록에는 `phone` 키가 없어야 한다.
 *    공개는 컨택 상세(M-02)가 전이를 확인한 뒤에만 한다.
 */
describe('의뢰가 받은 제안 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerToken: string;
  let otherCustomerToken: string;
  let proToken: string;
  let requestId: string;
  let proUserId: string;

  const customer = { email: 'c03-owner@example.com', password: 'Passw0rd!x' };
  const other = { email: 'c03-other@example.com', password: 'Passw0rd!x' };
  const pro = { email: 'c03-pro@example.com', password: 'Passw0rd!x' };

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
    /* 역할은 토큰 발급 시점에 박힌다. 다시 로그인해야 역할 가드를 통과한다. */
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(creds)
      .expect(200);
    return { token: login.body.accessToken as string, userId: res.body.user.id as string };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);

    const c = await signUp(customer, 'CUSTOMER');
    customerToken = c.token;
    otherCustomerToken = (await signUp(other, 'CUSTOMER')).token;
    const p = await signUp(pro, 'PRO');
    proToken = p.token;
    proUserId = p.userId;

    /* 의뢰 하나와 그 의뢰에 온 제안 하나를 만든다. */
    const created = await request(app.getHttpServer())
      .post('/api/reference-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ title: '제안 조회 테스트', areaPyeong: 24 })
      .expect(201);
    requestId = created.body.id;

    await prisma.referenceRequest.update({
      where: { id: requestId },
      data: { status: 'PUBLISHED' },
    });
    await prisma.contactRequest.create({
      data: {
        direction: 'PRO_TO_REQUEST',
        requesterUserId: proUserId,
        receiverUserId: c.userId,
        referenceRequestId: requestId,
        message: '시공 가능합니다.',
        proposedAmount: 780000,
        proposedAmountNote: '자재 포함 · 1일',
        expiresAt: new Date(Date.now() + 7 * 864e5),
      },
    });
    /* 연락처가 있는 시공자여야 유출 검사가 의미 있다. */
    await prisma.user.update({ where: { id: proUserId }, data: { phone: '01099998888' } });
  });

  /**
   * 정리는 의존 순서대로 해야 한다.
   *
   * `contact_requests` 와 `reference_requests` 의 FK 가 `onDelete: Restrict` 라서
   * 유저를 먼저 지우면 제약에 걸린다. **그게 맞는 설계다** — 분쟁이 생겼을 때
   * 컨택 이력이 유저 삭제로 함께 사라지면 아무것도 남지 않는다.
   */
  afterAll(async () => {
    const emails = [customer.email, other.email, pro.email];
    await prisma?.contactRequest.deleteMany({ where: { requester: { email: { in: emails } } } });
    await prisma?.referenceImage.deleteMany({
      where: { referenceRequest: { customer: { email: { in: emails } } } },
    });
    await prisma?.referenceRequest.deleteMany({ where: { customer: { email: { in: emails } } } });
    await prisma?.user.deleteMany({ where: { email: { in: emails } } });
    await app?.close();
  });

  const server = () => app.getHttpServer();
  const url = () => `/api/reference-requests/${requestId}/proposals`;

  it('소유자는 제안을 금액과 함께 본다', async () => {
    const res = await request(server())
      .get(url())
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].proposedAmount).toBe(780000);
    expect(res.body.items[0].proposedAmountNote).toBe('자재 포함 · 1일');
    expect(res.body.items[0].pro.id).toBe(proUserId);
  });

  it('연락처는 어디에도 실리지 않는다 — 수락 전이든 후든', async () => {
    const before = await request(server())
      .get(url())
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(JSON.stringify(before.body)).not.toContain('01099998888');

    /* 수락해도 이 목록은 변하지 않는다. 연락처 공개는 M-02 의 일이다. */
    await request(server())
      .post(`/api/contacts/${before.body.items[0].id}/accept`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    const after = await request(server())
      .get(url())
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(after.body.items[0].status).toBe('ACCEPTED');
    expect(JSON.stringify(after.body)).not.toContain('01099998888');
  });

  it('남의 의뢰는 404다 — 403이면 그 의뢰가 있다는 걸 알려준다', async () => {
    await request(server())
      .get(url())
      .set('Authorization', `Bearer ${otherCustomerToken}`)
      .expect(404);
  });

  it('시공자는 제안 목록을 볼 수 없다 — 경쟁 제안을 보게 된다', async () => {
    await request(server()).get(url()).set('Authorization', `Bearer ${proToken}`).expect(403);
  });

  it('비로그인은 볼 수 없다', async () => {
    await request(server()).get(url()).expect(401);
  });

  it('식별자는 userId 다 — `/pros/:id` 와 같은 이름이어야 링크가 산다', async () => {
    const res = await request(server())
      .get(url())
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    const profile = await prisma.userProfile.findFirst({
      where: { userId: proUserId, type: 'PRO' },
      select: { id: true },
    });
    /* userProfileId 로 냈다가 C-05 링크가 404 났던 전례가 있다. */
    expect(res.body.items[0].pro.id).not.toBe(profile?.id);
    expect(res.body.items[0].pro.id).toBe(proUserId);
  });

  it('마감한 의뢰의 제안도 계속 보인다 — 수락한 상대와의 이력이 사라지면 안 된다', async () => {
    await request(server())
      .post(`/api/reference-requests/${requestId}/close`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    const res = await request(server())
      .get(url())
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(res.body.items).toHaveLength(1);
  });
});
