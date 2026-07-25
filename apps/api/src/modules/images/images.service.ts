import { randomUUID } from 'node:crypto';

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import {
  ConflictError,
  MAGIC_NUMBER_PROBE_BYTES,
  NotFoundError,
  ValidationError,
  assertWithinLimits,
  buildStorageKey,
  matchesDeclaredType,
  type ImageNamespace,
} from '@fitter/domain';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_PORTFOLIO_IMAGES,
  MAX_REFERENCE_IMAGES,
} from '@fitter/shared';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { S3StorageAdapter } from '../../infra/storage/s3-storage.adapter';
import { ThumbnailQueue } from './thumbnail.queue';

/** 미소비 의도가 이 시간을 넘기면 고아로 본다. 업로드가 한 시간을 넘길 이유는 없다. */
const ORPHAN_TTL_MS = 60 * 60 * 1000;

const EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

/**
 * 의뢰 사진과 포트폴리오 사진이 **공유하는 공통 모듈**.
 *
 * 두 엔티티의 사진 처리는 개수 한도 말고는 같다. 따로 만들면
 * 한쪽만 고쳐지는 날이 오고, 그게 EXIF나 매직 넘버 검증이면 사고가 된다.
 *
 * 근거: brain/20-도메인/이미지 파이프라인.md
 */
@Injectable()
export class ImagesService implements OnModuleInit {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageAdapter,
    private readonly thumbnails: ThumbnailQueue,
  ) {}

  onModuleInit(): void {
    /* 주기 정리 작업이 이 서비스의 sweepOrphans를 부르게 연결한다. */
    this.thumbnails.registerSweepHandler(async () => {
      await this.sweepOrphans();
    });
  }

  /**
   * 서명 URL 발급.
   *
   * 여기서 **의도(intent)를 남긴다.** 이게 없으면 고아 파일을 찾으려고
   * 버킷 전체를 리스팅해야 하고, 무엇보다 남이 올린 키를 자기 것으로 등록할 수 있다.
   */
  async presign(input: {
    userId: string;
    namespace: ImageNamespace;
    contentType: string;
    contentLength: number;
    currentCount: number;
  }) {
    assertWithinLimits(input, {
      maxBytes: MAX_IMAGE_BYTES,
      maxCount: input.namespace === 'REFERENCE' ? MAX_REFERENCE_IMAGES : MAX_PORTFOLIO_IMAGES,
      allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
    });

    const extension = EXTENSION_BY_MIME[input.contentType];
    if (!extension) throw new ValidationError('지원하지 않는 이미지 형식입니다.');

    const now = new Date();
    const yyyymm = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const storageKey = buildStorageKey({
      namespace: input.namespace,
      yyyymm,
      uuid: randomUUID(),
      extension,
    });

    const presigned = await this.storage.presignUpload({
      contentType: input.contentType,
      contentLength: input.contentLength,
      namespace: storageKey,
    });

    await this.prisma.uploadIntent.create({
      data: {
        userId: input.userId,
        storageKey,
        namespace: input.namespace,
        contentType: input.contentType,
        declaredSize: input.contentLength,
      },
    });

    return { url: presigned.url, storageKey, expiresAt: presigned.expiresAt };
  }

  /**
   * 등록 시 검증하고 의도를 소비한다.
   *
   * 의뢰 사진(P4-3)과 포트폴리오 사진(P4-4)이 각자의 행을 만들기 **직전에** 부른다.
   * 검증이 여기 한 곳에 있어야 한쪽만 빠지는 일이 없다.
   */
  async verifyAndConsume(input: { userId: string; storageKey: string }): Promise<{
    contentType: string;
    byteSize: number;
  }> {
    const intent = await this.prisma.uploadIntent.findUnique({
      where: { storageKey: input.storageKey },
    });

    /* 남의 의도이거나 없는 키면 존재 자체를 알리지 않는다. */
    if (!intent || intent.userId !== input.userId) {
      throw new NotFoundError('업로드 정보를 찾을 수 없습니다.');
    }
    if (intent.consumedAt) {
      throw new ConflictError('이미 등록된 사진입니다.');
    }

    const actualSize = await this.storage.contentLength(input.storageKey);
    if (actualSize === null) {
      throw new ValidationError('업로드가 완료되지 않았습니다.');
    }
    /* 신고한 크기로 서명했지만 스토리지 구현이 느슨할 수 있어 한 번 더 본다. */
    if (actualSize > MAX_IMAGE_BYTES) {
      await this.discardQuietly(input.storageKey);
      throw new ValidationError('사진이 너무 큽니다.');
    }

    const head = await this.storage.readHead(input.storageKey, MAGIC_NUMBER_PROBE_BYTES);
    if (!head || !matchesDeclaredType(head, intent.contentType)) {
      /* 확장자 위조. 저장소에 남겨둘 이유가 없다. */
      await this.discardQuietly(input.storageKey);
      throw new ValidationError('이미지 파일이 아니거나 형식이 올바르지 않습니다.');
    }

    await this.prisma.uploadIntent.update({
      where: { id: intent.id },
      data: { consumedAt: new Date() },
    });

    await this.thumbnails.enqueue(input.storageKey);

    return { contentType: intent.contentType, byteSize: actualSize };
  }

  /** 업로드 중 취소. 스토리지에 잔여물을 남기지 않는다. */
  async discard(input: { userId: string; storageKey: string }): Promise<void> {
    const intent = await this.prisma.uploadIntent.findUnique({
      where: { storageKey: input.storageKey },
    });
    if (!intent || intent.userId !== input.userId) {
      throw new NotFoundError('업로드 정보를 찾을 수 없습니다.');
    }
    if (intent.consumedAt) {
      throw new ConflictError('이미 등록된 사진은 이 경로로 지울 수 없습니다.');
    }
    await this.discardQuietly(input.storageKey);
    await this.prisma.uploadIntent.delete({ where: { id: intent.id } });
  }

  /**
   * 고아 파일 정리.
   *
   * 스토리지에는 올라갔는데 등록 전에 창을 닫으면 파일만 남는다.
   * 방치하면 비용이 새고, 그 비용은 아무도 안 보는 곳에서 늘어난다.
   */
  async sweepOrphans(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - ORPHAN_TTL_MS);
    const orphans = await this.prisma.uploadIntent.findMany({
      where: { consumedAt: null, createdAt: { lt: cutoff } },
      select: { id: true, storageKey: true },
      take: 500,
    });

    for (const orphan of orphans) {
      await this.discardQuietly(orphan.storageKey);
    }
    if (orphans.length > 0) {
      await this.prisma.uploadIntent.deleteMany({
        where: { id: { in: orphans.map((o) => o.id) } },
      });
      this.logger.log({ count: orphans.length }, '고아 파일 정리');
    }
    return orphans.length;
  }

  /** 삭제 실패가 요청 실패로 번지지 않게 한다. 남으면 정리 배치가 다시 가져간다. */
  private async discardQuietly(storageKey: string): Promise<void> {
    try {
      await this.storage.delete(storageKey);
    } catch (error) {
      this.logger.warn({ storageKey, err: error }, '스토리지 삭제 실패');
    }
  }
}
