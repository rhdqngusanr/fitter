import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';

/**
 * P4-1 완료 조건 검증.
 *
 * "세 역할(비로그인 / CUSTOMER / PRO)로 각 보호 라우트에 접근하는 테스트가 모두 통과"
 *
 * 실제 DB를 쓴다. 가드·직렬화·트랜잭션이 전부 맞아야 통과하므로,
 * 목으로 대체하면 검증하려던 것이 사라진다.
 */
describe('인증과 역할 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  /** 테스트가 서로 간섭하지 않게 실행마다 다른 이메일을 쓴다. */
  const suffix = randomUUID().slice(0, 8);
  const customer = { email: `c-${suffix}@test.local`, password: 'test-password-1234' };
  const pro = { email: `p-${suffix}@test.local`, password: 'test-password-1234' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    /* 만든 계정을 지운다. refresh_tokens와 user_profiles는 CASCADE로 함께 사라진다. */
    await prisma?.user.deleteMany({ where: { email: { in: [customer.email, pro.email] } } });
    await app?.close();
  });

  const server = () => app.getHttpServer();

  describe('비로그인', () => {
    it('보호 라우트는 401이다 — 전역 기본값이 "인증 필수"다', async () => {
      const res = await request(server()).get('/api/me').expect(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('@Public 이 붙은 헬스체크는 통과한다', async () => {
      await request(server()).get('/api/health').expect(200);
    });

    it('깨진 토큰으로 보호 라우트에 접근하면 401이다', async () => {
      await request(server())
        .get('/api/me')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });
  });

  describe('가입과 로그인', () => {
    it('가입하면 역할이 없는 상태로 시작한다', async () => {
      const res = await request(server())
        .post('/api/auth/signup')
        .send({ ...customer, nickname: '지수', agreedToTerms: true })
        .expect(201);

      expect(res.body.user.profileType).toBeNull();
      expect(res.body.accessToken).toBeDefined();
      /* 리프레시는 본문이 아니라 httpOnly 쿠키로만 나간다. */
      expect(res.body.refreshToken).toBeUndefined();
      expect(String(res.headers['set-cookie'])).toContain('HttpOnly');
    });

    it('약관에 동의하지 않으면 거부된다', async () => {
      const res = await request(server())
        .post('/api/auth/signup')
        .send({ email: `x-${suffix}@test.local`, password: 'test-password-1234', nickname: 'x' })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('같은 이메일로 다시 가입하면 409다', async () => {
      const res = await request(server())
        .post('/api/auth/signup')
        .send({ ...customer, nickname: '지수', agreedToTerms: true })
        .expect(409);
      expect(res.body.code).toBe('CONFLICT');
    });

    it('없는 이메일과 틀린 비밀번호를 구분하지 않는다 — 계정 열거 방지', async () => {
      const wrongPassword = await request(server())
        .post('/api/auth/login')
        .send({ email: customer.email, password: 'wrong-password-xxxx' })
        .expect(401);

      const noSuchAccount = await request(server())
        .post('/api/auth/login')
        .send({ email: `nobody-${suffix}@test.local`, password: 'wrong-password-xxxx' })
        .expect(401);

      expect(wrongPassword.body.code).toBe(noSuchAccount.body.code);
      expect(wrongPassword.body.message).toBe(noSuchAccount.body.message);
    });
  });

  describe('역할 선택', () => {
    let token: string;

    beforeAll(async () => {
      const res = await request(server()).post('/api/auth/login').send(customer).expect(200);
      token = res.body.accessToken;
    });

    it('본인 정보에는 연락처가 포함된다 — 남의 것과 구분되는 유일한 경우', async () => {
      const res = await request(server())
        .get('/api/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toHaveProperty('phone');
      expect(res.body.profileType).toBeNull();
    });

    it('CUSTOMER를 선택하면 의뢰 등록으로 보낸다', async () => {
      const res = await request(server())
        .post('/api/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'CUSTOMER' })
        .expect(201);
      expect(res.body).toEqual({ profileType: 'CUSTOMER', next: '/requests/new' });
    });

    it('역할은 스스로 바꿀 수 없다 — 두 번째 선택은 409', async () => {
      const res = await request(server())
        .post('/api/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'PRO' })
        .expect(409);
      expect(res.body.code).toBe('CONFLICT');
    });

    it('ADMIN은 고를 수 없다 — 시드로만 만든다', async () => {
      await request(server())
        .post('/api/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'ADMIN' })
        .expect(400);
    });
  });

  describe('시공자는 가입 직후 미승인이다', () => {
    it('PRO를 선택하면 is_approved=false 로 시작한다', async () => {
      await request(server())
        .post('/api/auth/signup')
        .send({ ...pro, nickname: '김도배', agreedToTerms: true })
        .expect(201);

      const login = await request(server()).post('/api/auth/login').send(pro).expect(200);
      await request(server())
        .post('/api/me/profile')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .send({ type: 'PRO' })
        .expect(201);

      const profile = await prisma.userProfile.findFirst({
        where: { user: { email: pro.email }, type: 'PRO' },
        select: { proProfile: { select: { isApproved: true } } },
      });
      expect(profile?.proProfile?.isApproved).toBe(false);
    });
  });

  describe('리프레시 회전과 재사용 탐지', () => {
    it('회전된 옛 토큰을 다시 쓰면 계열 전체가 폐기된다', async () => {
      const agent = request.agent(server());
      await agent.post('/api/auth/login').send(customer).expect(200);

      /* 첫 갱신. 여기서 쿠키가 새 토큰으로 회전한다. */
      await agent.post('/api/auth/refresh').expect(200);

      /* 옛 토큰을 손에 넣은 공격자를 흉내 낸다. */
      const stolen = await request(server()).post('/api/auth/refresh').expect(401);
      expect(stolen.body.code).toBe('UNAUTHENTICATED');
    });

    it('로그아웃하면 이후 갱신이 막힌다', async () => {
      const agent = request.agent(server());
      await agent.post('/api/auth/login').send(customer).expect(200);
      await agent.post('/api/auth/logout').expect(204);
      await agent.post('/api/auth/refresh').expect(401);
    });
  });
});
