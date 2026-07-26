import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';

/**
 * 시공자 프로필 편집 (P-01).
 *
 * 여기서 고정하는 건 셋이다.
 *
 * 1. **완성도가 실제로 갱신된다.** 컬럼은 처음부터 있었지만 아무도 쓰지 않아 항상 0이었다.
 * 2. **연락처는 본인에게만 돌아온다.** 남의 프로필 어디에도 실리지 않는다.
 * 3. **`isDormant` 를 끄고 켤 수 있다.** 입력 스키마에 없어서 되돌릴 방법이 없었다.
 */
describe('시공자 프로필 편집 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let proToken: string;
  let proUserId: string;
  let customerToken: string;

  const pro = { email: 'p01-pro@example.com', password: 'Passw0rd!x' };
  const customer = { email: 'p01-customer@example.com', password: 'Passw0rd!x' };

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
    /*
     * **역할을 고른 뒤 다시 로그인해야 한다.** 역할은 토큰 발급 시점에 박히므로
     * 가입 때 받은 토큰에는 아직 역할이 없고, 역할 가드가 403 을 낸다.
     * 이걸 빼먹고 6개가 403 으로 죽었다 — 토큰-역할 계약이 실제로 지켜지고 있다는 뜻이다.
     */
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
    customerToken = (await signUp(customer, 'CUSTOMER')).token;
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { email: { in: [pro.email, customer.email] } } });
    await app?.close();
  });

  const server = () => app.getHttpServer();
  const asPro = (req: request.Test) => req.set('Authorization', `Bearer ${proToken}`);

  it('역할 선택 직후 프로필은 비어 있고 완성도 0%다', async () => {
    const res = await asPro(request(server()).get('/api/me/pro-profile')).expect(200);
    expect(res.body.businessName).toBe('');
    expect(res.body.completeness.percent).toBe(0);
    expect(res.body.completeness.requiredMet).toBe(false);
  });

  it('필수 셋을 채우면 requiredMet 이 참이 되고 완성도가 갱신된다', async () => {
    const res = await asPro(request(server()).put('/api/me/pro-profile'))
      .send({
        businessName: '성북 한도배',
        workCategoryCodes: ['WALLPAPER'],
        regionCodes: ['11290'],
      })
      .expect(200);

    expect(res.body.completeness.requiredMet).toBe(true);
    /* 5항목 중 공종·지역만 찬 상태. 연락처가 없어 IDENTITY 는 미완이다. */
    expect(res.body.completeness.percent).toBe(40);

    /* 컬럼에 실제로 저장됐는지 — 응답만 맞고 DB 가 0인 경우를 막는다. */
    const row = await prisma.proProfile.findFirst({
      where: { userProfile: { userId: proUserId } },
      select: { profileCompleteness: true },
    });
    expect(row?.profileCompleteness).toBe(40);
  });

  it('PATCH /me 로 연락처를 저장하면 완성도가 오른다 — 하이픈은 지운다', async () => {
    await asPro(request(server()).patch('/api/me'))
      .send({ phone: '010-1111-2222' })
      .expect(200);

    const stored = await prisma.user.findUnique({
      where: { id: proUserId },
      select: { phone: true },
    });
    expect(stored?.phone).toBe('01011112222');

    /* 저장을 한 번 더 거쳐야 완성도 컬럼이 갱신된다(계산 시점이 저장이다). */
    const res = await asPro(request(server()).put('/api/me/pro-profile'))
      .send({
        businessName: '성북 한도배',
        workCategoryCodes: ['WALLPAPER'],
        regionCodes: ['11290'],
      })
      .expect(200);
    expect(res.body.completeness.percent).toBe(60);
  });

  it('본인 조회에는 연락처가 실린다 — 본인 것이므로 명시 공개다', async () => {
    const res = await asPro(request(server()).get('/api/me/pro-profile')).expect(200);
    expect(res.body.phone).toBe('01011112222');
  });

  it('공개 프로필에는 연락처 키가 아예 없다', async () => {
    await prisma.proProfile.updateMany({
      where: { userProfile: { userId: proUserId } },
      data: { isApproved: true },
    });

    const res = await request(server()).get(`/api/pros/${proUserId}`).expect(200);
    expect('phone' in res.body).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain('01011112222');
  });

  it('isDormant 를 켜고 끌 수 있다 — 휴면은 되돌릴 수 있어야 한다', async () => {
    const base = {
      businessName: '성북 한도배',
      workCategoryCodes: ['WALLPAPER'],
      regionCodes: ['11290'],
    };

    await asPro(request(server()).put('/api/me/pro-profile'))
      .send({ ...base, isDormant: true })
      .expect(200);
    /* 휴면이면 공개 목록에서 내려간다 — 승인 상태와 무관하다. */
    await request(server()).get(`/api/pros/${proUserId}`).expect(404);

    await asPro(request(server()).put('/api/me/pro-profile'))
      .send({ ...base, isDormant: false })
      .expect(200);
    await request(server()).get(`/api/pros/${proUserId}`).expect(200);
  });

  it('고객은 시공자 프로필을 저장할 수 없다', async () => {
    await request(server())
      .put('/api/me/pro-profile')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ businessName: '몰래' })
      .expect(403);
  });

  it('PATCH /me 는 빈 본문을 거부한다 — 아무 일도 안 하는 200 은 버그를 숨긴다', async () => {
    await asPro(request(server()).patch('/api/me')).send({}).expect(400);
  });

  it('잘못된 연락처는 어긋난 필드를 details.issues[].path 로 지목한다', async () => {
    const res = await asPro(request(server()).patch('/api/me'))
      .send({ phone: '0101234' })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    /* 화면이 이 경로로 필드를 빨갛게 만든다. 모양이 바뀌면 검증 오류 상태가 죽는다. */
    expect(res.body.details.issues[0].path).toBe('phone');
  });
});
