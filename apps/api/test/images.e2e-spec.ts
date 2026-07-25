import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { MAX_IMAGE_BYTES } from '@fitter/shared';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { S3StorageAdapter } from '../src/infra/storage/s3-storage.adapter';
import { ImagesService } from '../src/modules/images/images.service';

/**
 * P4-2 완료 조건 검증.
 *
 * "10MB 초과, 잘못된 확장자, 확장자 위조 파일이 모두 거부되는 테스트"
 * "업로드 중 취소 시 스토리지에 잔여물이 남지 않는 것 확인"
 *
 * MinIO에 실제로 올린다. 목으로 대체하면 서명 URL과 매직 넘버 검증이
 * 진짜로 도는지 확인할 수 없다.
 */
describe('이미지 파이프라인 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: S3StorageAdapter;
  let images: ImagesService;
  let token: string;
  let userId: string;

  const email = `img-${randomUUID().slice(0, 8)}@test.local`;

  /** 최소한의 진짜 JPEG. FF D8 FF 로 시작해야 매직 넘버를 통과한다. */
  const jpegBytes = (): Buffer => {
    const buf = Buffer.alloc(1024);
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
    buf[3] = 0xe0;
    return buf;
  };

  /** jpg라고 신고하지만 실제로는 Windows 실행 파일. */
  const disguisedExe = (): Buffer => {
    const buf = Buffer.alloc(1024);
    buf[0] = 0x4d; // M
    buf[1] = 0x5a; // Z
    return buf;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);
    storage = app.get(S3StorageAdapter);
    images = app.get(ImagesService);

    const signup = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ email, password: 'test-password-1234', nickname: '테스터', agreedToTerms: true })
      .expect(201);
    token = signup.body.accessToken;
    userId = signup.body.user.id;
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { email } });
    await app?.close();
  });

  const presign = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/images/presign')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  describe('업로드 전 검증', () => {
    it('비로그인은 서명 URL을 받을 수 없다', async () => {
      await request(app.getHttpServer())
        .post('/api/images/presign')
        .send({ namespace: 'REFERENCE', contentType: 'image/jpeg', contentLength: 1024 })
        .expect(401);
    });

    it('10MB를 넘으면 거부한다', async () => {
      const res = await presign({
        namespace: 'REFERENCE',
        contentType: 'image/jpeg',
        contentLength: MAX_IMAGE_BYTES + 1,
      }).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('허용하지 않는 형식은 거부한다', async () => {
      const res = await presign({
        namespace: 'REFERENCE',
        contentType: 'application/pdf',
        contentLength: 1024,
      }).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('의뢰 사진은 10장을 넘길 수 없다', async () => {
      await presign({
        namespace: 'REFERENCE',
        contentType: 'image/jpeg',
        contentLength: 1024,
        currentCount: 10,
      }).expect(400);
    });
  });

  describe('업로드와 등록', () => {
    it('정상 흐름 — 서명 URL로 직접 올리고 등록한다', async () => {
      const res = await presign({
        namespace: 'REFERENCE',
        contentType: 'image/jpeg',
        contentLength: 1024,
      }).expect(201);

      const { url, storageKey } = res.body;
      expect(storageKey).toMatch(/^reference\/\d{4}-\d{2}\/.+\.jpg$/);

      /* 파일이 서버를 경유하지 않는다. 클라이언트가 스토리지에 직접 PUT 한다. */
      const put = await fetch(url, {
        method: 'PUT',
        body: jpegBytes(),
        headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1024' },
      });
      expect(put.ok).toBe(true);

      const result = await images.verifyAndConsume({ userId, storageKey });
      expect(result.byteSize).toBe(1024);
      expect(await storage.exists(storageKey)).toBe(true);
    });

    it('확장자 위조 파일은 거부하고 스토리지에서도 지운다', async () => {
      const res = await presign({
        namespace: 'REFERENCE',
        contentType: 'image/jpeg',
        contentLength: 1024,
      }).expect(201);
      const { url, storageKey } = res.body;

      await fetch(url, {
        method: 'PUT',
        body: disguisedExe(),
        headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1024' },
      });
      /* 스토리지에는 일단 올라간다 — 서명 URL은 내용을 못 본다. */
      expect(await storage.exists(storageKey)).toBe(true);

      await expect(images.verifyAndConsume({ userId, storageKey })).rejects.toThrow();
      /* 서버가 매직 넘버로 잡아내고 잔여물까지 치운다. */
      expect(await storage.exists(storageKey)).toBe(false);
    });

    it('같은 키를 두 번 등록할 수 없다', async () => {
      const res = await presign({
        namespace: 'PORTFOLIO',
        contentType: 'image/jpeg',
        contentLength: 1024,
      }).expect(201);
      const { url, storageKey } = res.body;
      await fetch(url, {
        method: 'PUT',
        body: jpegBytes(),
        headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1024' },
      });

      await images.verifyAndConsume({ userId, storageKey });
      await expect(images.verifyAndConsume({ userId, storageKey })).rejects.toThrow();
    });

    it('남이 발급받은 키는 등록할 수 없다', async () => {
      const res = await presign({
        namespace: 'REFERENCE',
        contentType: 'image/jpeg',
        contentLength: 1024,
      }).expect(201);

      await expect(
        images.verifyAndConsume({ userId: randomUUID(), storageKey: res.body.storageKey }),
      ).rejects.toThrow();
    });
  });

  describe('취소와 고아 파일', () => {
    it('취소하면 스토리지에 잔여물이 남지 않는다', async () => {
      const res = await presign({
        namespace: 'REFERENCE',
        contentType: 'image/jpeg',
        contentLength: 1024,
      }).expect(201);
      const { url, storageKey } = res.body;

      await fetch(url, {
        method: 'PUT',
        body: jpegBytes(),
        headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1024' },
      });
      expect(await storage.exists(storageKey)).toBe(true);

      await request(app.getHttpServer())
        .delete(`/api/images?storageKey=${encodeURIComponent(storageKey)}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(await storage.exists(storageKey)).toBe(false);
      const intent = await prisma.uploadIntent.findUnique({ where: { storageKey } });
      expect(intent).toBeNull();
    });

    it('등록 전에 창을 닫으면 정리 배치가 가져간다', async () => {
      const res = await presign({
        namespace: 'REFERENCE',
        contentType: 'image/jpeg',
        contentLength: 1024,
      }).expect(201);
      const { url, storageKey } = res.body;
      await fetch(url, {
        method: 'PUT',
        body: jpegBytes(),
        headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1024' },
      });

      /* 두 시간 뒤에 배치가 돈다고 가정한다. */
      const later = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const swept = await images.sweepOrphans(later);

      expect(swept).toBeGreaterThan(0);
      expect(await storage.exists(storageKey)).toBe(false);
      expect(await prisma.uploadIntent.findUnique({ where: { storageKey } })).toBeNull();
    });
  });
});
