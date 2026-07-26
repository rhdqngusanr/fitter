import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';

/**
 * 관리자 큐 (A-01 · A-02).
 *
 * 여기서 고정하는 건 셋이다.
 *
 * 1. **ADMIN 만 들어온다.** 승인 권한이 새면 누구나 자기를 승인할 수 있다.
 * 2. **위험 신호가 실데이터에서 나온다.** 화면이 지어내지 않는다는 걸 못 박는다.
 * 3. **승인은 되돌릴 수 있다.** 되돌리면 그 시공자의 사례가 공개에서 즉시 빠진다.
 */
describe('관리자 큐 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let proToken: string;
  let proUserId: string;
  let proProfileId: string;

  const admin = { email: 'adm-e2e@example.com', password: 'Passw0rd!admin' };
  const pro = { email: 'adm-pro@example.com', password: 'Passw0rd!x' };

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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);

    const p = await signUp(pro, 'PRO');
    proToken = p.token;
    proUserId = p.userId;
    const profile = await prisma.userProfile.findFirst({
      where: { userId: proUserId, type: 'PRO' },
      select: { id: true },
    });
    proProfileId = profile!.id;

    /*
     * ADMIN 은 가입 경로가 없다(그게 맞다). CUSTOMER 로 만든 뒤 프로필 타입을 바꾼다 —
     * `prisma/seed-admin.ts` 가 하는 일과 같다.
     */
    const a = await signUp(admin, 'CUSTOMER');
    await prisma.customerProfile.deleteMany({ where: { userProfile: { userId: a.userId } } });
    await prisma.userProfile.updateMany({
      where: { userId: a.userId },
      data: { type: 'ADMIN' },
    });
    /* 역할은 토큰 발급 시점에 박힌다. 바꾼 뒤 다시 로그인해야 ADMIN 이 된다. */
    const relogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(admin)
      .expect(200);
    adminToken = relogin.body.accessToken;
  });

  afterAll(async () => {
    const emails = [admin.email, pro.email];
    await prisma?.report.deleteMany({ where: { reporter: { email: { in: emails } } } });
    await prisma?.portfolioItem.deleteMany({ where: { pro: { email: { in: emails } } } });
    await prisma?.user.deleteMany({ where: { email: { in: emails } } });
    await app?.close();
  });

  const server = () => app.getHttpServer();
  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${adminToken}`);

  it('ADMIN 이 아니면 승인 큐를 볼 수 없다 — 새면 누구나 자기를 승인한다', async () => {
    await request(server())
      .get('/api/admin/pro-approvals')
      .set('Authorization', `Bearer ${proToken}`)
      .expect(403);
    await request(server()).get('/api/admin/pro-approvals').expect(401);
  });

  it('시공자는 자기를 승인할 수 없다', async () => {
    await request(server())
      .post(`/api/admin/pro-approvals/${proProfileId}`)
      .set('Authorization', `Bearer ${proToken}`)
      .send({ approved: true })
      .expect(403);
  });

  it('위험 신호가 실데이터에서 계산된다 — 빈 프로필은 신호가 여러 개다', async () => {
    const res = await asAdmin(request(server()).get('/api/admin/pro-approvals')).expect(200);
    const row = res.body.items.find(
      (i: { userProfileId: string }) => i.userProfileId === proProfileId,
    );

    expect(row).toBeDefined();
    /* 방금 역할만 고른 계정이다. 채운 게 없으므로 신호가 다 켜져야 한다. */
    expect(row.flags).toContain('활동명 미입력');
    expect(row.flags).toContain('사업자번호 미제출');
    expect(row.flags).toContain('공종 미선택');
    expect(row.flags).toContain('포트폴리오 0건');
    expect(row.risk).toBe('high');
    expect(row.portfolioCount).toBe(0);
    /* 화면 링크용 식별자는 `userId` 다 — `/pros/:id` 와 같은 이름이어야 한다. */
    expect(row.userId).toBe(proUserId);
  });

  it('프로필을 채우면 신호가 줄어든다', async () => {
    await request(server())
      .put('/api/me/pro-profile')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        businessName: '심사용 도배',
        businessNumber: '4123190287',
        intro: '도배만 합니다.',
        workCategoryCodes: ['WALLPAPER'],
        regionCodes: ['11290'],
      })
      .expect(200);

    const res = await asAdmin(request(server()).get('/api/admin/pro-approvals')).expect(200);
    const row = res.body.items.find(
      (i: { userProfileId: string }) => i.userProfileId === proProfileId,
    );
    /* 남는 신호는 포트폴리오 0건뿐이다. */
    expect(row.flags).toEqual(['포트폴리오 0건']);
    expect(row.risk).toBe('mid');
  });

  it('승인하면 큐에서 빠지고, 되돌리면 돌아온다', async () => {
    await asAdmin(request(server()).post(`/api/admin/pro-approvals/${proProfileId}`))
      .send({ approved: true })
      .expect(200);

    const after = await asAdmin(request(server()).get('/api/admin/pro-approvals')).expect(200);
    expect(
      after.body.items.some((i: { userProfileId: string }) => i.userProfileId === proProfileId),
    ).toBe(false);
    /* 승인되면 공개 프로필이 생긴다. */
    await request(server()).get(`/api/pros/${proUserId}`).expect(200);

    /* 되돌리기 = approved:false. 공개 프로필이 즉시 사라져야 한다. */
    await asAdmin(request(server()).post(`/api/admin/pro-approvals/${proProfileId}`))
      .send({ approved: false, reason: '승인을 되돌렸습니다.' })
      .expect(200);
    await request(server()).get(`/api/pros/${proUserId}`).expect(404);

    const back = await asAdmin(request(server()).get('/api/admin/pro-approvals')).expect(200);
    const row = back.body.items.find(
      (i: { userProfileId: string }) => i.userProfileId === proProfileId,
    );
    expect(row.rejectionReason).toBe('승인을 되돌렸습니다.');
  });

  it('이미 승인된 시공자를 다시 승인하면 409다', async () => {
    await asAdmin(request(server()).post(`/api/admin/pro-approvals/${proProfileId}`))
      .send({ approved: true })
      .expect(200);
    await asAdmin(request(server()).post(`/api/admin/pro-approvals/${proProfileId}`))
      .send({ approved: true })
      .expect(409);
  });

  it('신고 큐가 대상 이름과 누적 횟수를 함께 준다 — UUID 만으로는 판단할 수 없다', async () => {
    /* 같은 대상에 신고 둘. 재발이 심각도의 대체다. */
    const target = await prisma.portfolioItem.create({
      data: { proUserId, title: '신고 대상 사례', status: 'PUBLISHED' },
      select: { id: true },
    });
    await prisma.report.createMany({
      data: [
        {
          type: 'COPYRIGHT',
          targetType: 'PORTFOLIO_ITEM',
          targetId: target.id,
          reason: '우리 사진입니다.',
          rightsHolderName: '스튜디오',
        },
        {
          type: 'INAPPROPRIATE',
          targetType: 'PORTFOLIO_ITEM',
          targetId: target.id,
          reason: '부적절합니다.',
        },
      ],
    });

    const res = await asAdmin(request(server()).get('/api/admin/reports')).expect(200);
    const mine = res.body.items.filter(
      (r: { targetId: string }) => r.targetId === target.id,
    );
    expect(mine).toHaveLength(2);
    expect(mine[0].target.label).toBe('신고 대상 사례');
    expect(mine[0].target.repeatCount).toBe(2);

    /* 인정하면 대상이 즉시 비공개가 된다. 권리자가 기다릴 이유가 없다. */
    await asAdmin(request(server()).post(`/api/admin/reports/${mine[0].id}/resolve`))
      .send({ accept: true })
      .expect(200);
    const hidden = await prisma.portfolioItem.findUnique({
      where: { id: target.id },
      select: { status: true },
    });
    expect(hidden?.status).toBe('HIDDEN');

    /* 두 번째 신고에는 대상이 이미 비공개라고 보여야 한다. */
    const again = await asAdmin(request(server()).get('/api/admin/reports')).expect(200);
    const second = again.body.items.find((r: { id: string }) => r.id === mine[1].id);
    expect(second.target.status).toBe('HIDDEN');

    /* 같은 신고를 두 번 처리하면 409다. */
    await asAdmin(request(server()).post(`/api/admin/reports/${mine[0].id}/resolve`))
      .send({ accept: false })
      .expect(409);
  });
});
