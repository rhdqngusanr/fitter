import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';

/**
 * 시공자 목록·상세 (C-06 · C-07).
 *
 * 이 조회의 위험은 하나다 — **공개하면 안 되는 시공자를 공개하는 것.**
 * 포트폴리오와 정확히 같은 조건(승인됨 + 휴면 아님)이어야 하고, 두 곳이 갈라지면
 * 갤러리에는 보이는데 프로필은 404 이거나 그 반대가 된다.
 *
 * 그래서 여기서 고정하는 건 화면 모양이 아니라 **가시성 규칙과 식별자**다.
 */
describe('시공자 조회 (e2e)', () => {
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
    await app?.close();
  });

  const server = () => app.getHttpServer();

  it('비로그인도 조회할 수 있다 — 포트폴리오가 공개인데 만든 사람이 비공개면 앞뒤가 안 맞는다', async () => {
    const res = await request(server()).get('/api/pros').expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.hasAnyContent).toBe('boolean');
  });

  it('연락처는 어떤 경로로도 나오지 않는다', async () => {
    const res = await request(server()).get('/api/pros').expect(200);
    expect(JSON.stringify(res.body)).not.toContain('phone');
  });

  it('미승인·휴면·상호 없는 프로필은 목록에 없다', async () => {
    const res = await request(server()).get('/api/pros').expect(200);
    const ids: string[] = res.body.items.map((p: { id: string }) => p.id);
    if (ids.length === 0) return;

    const rows = await prisma.proProfile.findMany({
      where: { userProfile: { userId: { in: ids } } },
      select: { isApproved: true, isDormant: true, businessName: true },
    });
    for (const row of rows) {
      expect(row.isApproved).toBe(true);
      expect(row.isDormant).toBe(false);
      expect(row.businessName).not.toBe('');
    }
  });

  it('없는 시공자는 404다 — 미승인과 구분해 알려주지 않는다', async () => {
    await request(server()).get('/api/pros/00000000-0000-0000-0000-000000000000').expect(404);
  });

  /**
   * **같은 사람을 부르는 이름이 하나여야 한다.**
   *
   * 처음에 이 API 가 `userProfileId` 를 쓰고 포트폴리오 API 는 `userId` 를 써서
   * 갤러리 상세의 `프로필 전체 보기` 링크가 404 가 났다. 그 회귀를 여기서 막는다.
   */
  it('시공자 식별자가 포트폴리오 API 의 `pro.id` 와 같다', async () => {
    const gallery = await request(server()).get('/api/portfolios?limit=1').expect(200);
    const item = gallery.body.items[0] as { pro: { id: string } } | undefined;
    if (!item) return;

    await request(server()).get(`/api/pros/${item.pro.id}`).expect(200);
  });

  it('상세는 그 시공자의 공개된 사례만 담는다', async () => {
    const list = await request(server()).get('/api/pros').expect(200);
    const first = list.body.items[0] as { id: string } | undefined;
    if (!first) return;

    const res = await request(server()).get(`/api/pros/${first.id}`).expect(200);
    const ids: string[] = res.body.portfolios.map((p: { id: string }) => p.id);
    if (ids.length === 0) return;

    const rows = await prisma.portfolioItem.findMany({
      where: { id: { in: ids } },
      select: { status: true, deletedAt: true, proUserId: true },
    });
    for (const row of rows) {
      expect(row.status).toBe('PUBLISHED');
      expect(row.deletedAt).toBeNull();
      expect(row.proUserId).toBe(first.id);
    }
  });
});
