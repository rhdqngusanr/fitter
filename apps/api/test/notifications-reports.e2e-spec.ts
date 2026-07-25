import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';

/**
 * P4-7 알림·신고·관리자.
 *
 * 핵심은 **상태 변화가 알림을 낳는다**는 것이다(구조적 원칙 4).
 * 상태머신은 알림을 직접 호출하지 않고 포트 뒤로 던지는데,
 * 그게 실제로 도착하는지 여기서 확인한다.
 */
describe('알림·신고·관리자 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = randomUUID().slice(0, 8);
  const customer = { email: `nr-c-${suffix}@test.local`, password: 'test-password-1234' };
  const pro = { email: `nr-p-${suffix}@test.local`, password: 'test-password-1234' };
  const admin = { email: `nr-a-${suffix}@test.local`, password: 'test-password-1234' };

  let customerToken: string;
  let proToken: string;
  let adminToken: string;
  let proProfileId: string;
  let portfolioId: string;

  const signUp = async (creds: typeof pro, role: 'CUSTOMER' | 'PRO' | 'ADMIN') => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ ...creds, nickname: 'T', agreedToTerms: true })
      .expect(201);

    if (role === 'ADMIN') {
      /* ADMIN은 가입 경로가 없다. 시드로만 만든다 — 테스트도 같은 경로를 흉내 낸다. */
      await prisma.userProfile.create({ data: { userId: res.body.user.id, type: 'ADMIN' } });
    } else {
      await request(app.getHttpServer())
        .post('/api/me/profile')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .send({ type: role })
        .expect(201);
    }

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

    customerToken = (await signUp(customer, 'CUSTOMER')).token;
    const p = await signUp(pro, 'PRO');
    proToken = p.token;
    adminToken = (await signUp(admin, 'ADMIN')).token;

    const profile = await prisma.userProfile.findFirst({
      where: { userId: p.userId, type: 'PRO' },
      select: { id: true },
    });
    proProfileId = profile!.id;

    const created = await request(app.getHttpServer())
      .post('/api/portfolios')
      .set({ Authorization: `Bearer ${proToken}` })
      .expect(201);
    portfolioId = created.body.id;
  });

  afterAll(async () => {
    const emails = [customer.email, pro.email, admin.email];
    await prisma?.report.deleteMany({ where: { reporter: { email: { in: emails } } } });
    await prisma?.contactRequest.deleteMany({ where: { requester: { email: { in: emails } } } });
    await prisma?.portfolioItem.deleteMany({ where: { pro: { email: { in: emails } } } });
    await prisma?.user.deleteMany({ where: { email: { in: emails } } });
    await app?.close();
  });

  const server = () => app.getHttpServer();
  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const asPro = () => ({ Authorization: `Bearer ${proToken}` });
  const asCustomer = () => ({ Authorization: `Bearer ${customerToken}` });

  describe('관리자 권한 격리', () => {
    it('고객은 승인 큐에 접근할 수 없다', async () => {
      await request(server()).get('/api/admin/pro-approvals').set(asCustomer()).expect(403);
    });

    it('시공자도 접근할 수 없다', async () => {
      await request(server()).get('/api/admin/pro-approvals').set(asPro()).expect(403);
    });

    it('비로그인은 401이다 — 관리자 경로의 존재를 추측할 정보를 주지 않는다', async () => {
      await request(server()).get('/api/admin/pro-approvals').expect(401);
    });
  });

  describe('시공자 승인', () => {
    it('승인 대기 목록에 뜬다', async () => {
      const res = await request(server())
        .get('/api/admin/pro-approvals')
        .set(asAdmin())
        .expect(200);
      const found = res.body.items.find(
        (i: { userProfileId: string }) => i.userProfileId === proProfileId,
      );
      expect(found).toBeDefined();
    });

    it('승인하면 시공자에게 알림이 간다', async () => {
      await request(server())
        .post(`/api/admin/pro-approvals/${proProfileId}`)
        .set(asAdmin())
        .send({ approved: true })
        .expect(200);

      const notifications = await request(server())
        .get('/api/me/notifications')
        .set(asPro())
        .expect(200);
      expect(
        notifications.body.items.some((n: { kind: string }) => n.kind === 'PRO_APPROVED'),
      ).toBe(true);
      expect(notifications.body.unreadCount).toBeGreaterThan(0);
    });

    it('이미 승인된 시공자를 또 승인할 수 없다', async () => {
      await request(server())
        .post(`/api/admin/pro-approvals/${proProfileId}`)
        .set(asAdmin())
        .send({ approved: true })
        .expect(409);
    });
  });

  describe('알림 읽음', () => {
    it('전체 읽음 처리하면 미읽음이 0이 된다', async () => {
      await request(server()).post('/api/me/notifications/read').set(asPro()).expect(200);
      const res = await request(server()).get('/api/me/notifications').set(asPro()).expect(200);
      expect(res.body.unreadCount).toBe(0);
    });

    it('남의 알림은 읽음 처리되지 않는다', async () => {
      const mine = await request(server()).get('/api/me/notifications').set(asPro()).expect(200);
      const id = mine.body.items[0]?.id;
      if (!id) return;
      const res = await request(server())
        .post(`/api/me/notifications/${id}/read`)
        .set(asCustomer())
        .expect(200);
      expect(res.body.updated).toBe(0);
    });
  });

  describe('신고', () => {
    it('저작권 신고는 비로그인도 할 수 있다 — 권리자가 계정을 가질 이유가 없다', async () => {
      const res = await request(server())
        .post('/api/reports')
        .send({
          type: 'COPYRIGHT',
          targetType: 'PORTFOLIO_ITEM',
          targetId: portfolioId,
          rightsHolderName: '오늘의집',
          rightsHolderContact: 'legal@example.com',
          originalSourceUrl: 'https://ohou.se/contents/12345',
        })
        .expect(201);
      expect(res.body.status).toBe('PENDING');
    });

    it('저작권 신고에 권리자 정보가 없으면 거부한다', async () => {
      await request(server())
        .post('/api/reports')
        .send({ type: 'COPYRIGHT', targetType: 'PORTFOLIO_ITEM', targetId: portfolioId })
        .expect(400);
    });

    it('일반 신고는 로그인이 필요하다 — 익명 신고 폭탄을 막는다', async () => {
      await request(server())
        .post('/api/reports')
        .send({ type: 'SPAM', targetType: 'PORTFOLIO_ITEM', targetId: portfolioId })
        .expect(400);

      await request(server())
        .post('/api/reports')
        .set(asCustomer())
        .send({ type: 'SPAM', targetType: 'PORTFOLIO_ITEM', targetId: portfolioId, reason: '도배' })
        .expect(201);
    });

    it('관리자가 인정하면 대상이 즉시 비공개된다', async () => {
      const queue = await request(server()).get('/api/admin/reports').set(asAdmin()).expect(200);
      const target = queue.body.items.find((r: { targetId: string }) => r.targetId === portfolioId);
      expect(target).toBeDefined();

      await request(server())
        .post(`/api/admin/reports/${target.id}/resolve`)
        .set(asAdmin())
        .send({ accept: true })
        .expect(200);

      const item = await prisma.portfolioItem.findUnique({ where: { id: portfolioId } });
      expect(item?.status).toBe('HIDDEN');
    });

    it('이미 처리된 신고는 다시 처리할 수 없다', async () => {
      const resolved = await prisma.report.findFirst({
        where: { targetId: portfolioId, status: 'ACCEPTED' },
        select: { id: true },
      });
      await request(server())
        .post(`/api/admin/reports/${resolved!.id}/resolve`)
        .set(asAdmin())
        .send({ accept: false })
        .expect(409);
    });
  });
});
