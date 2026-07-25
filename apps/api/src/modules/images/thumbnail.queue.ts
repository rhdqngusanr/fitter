import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import sharp from 'sharp';

import { thumbnailKey } from '@fitter/domain';
import { THUMBNAIL_DETAIL_WIDTH, THUMBNAIL_LIST_WIDTH } from '@fitter/shared';

import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { S3StorageAdapter } from '../../infra/storage/s3-storage.adapter';

const QUEUE_NAME = 'thumbnails';

/** 파생 작업과 정리 작업이 한 큐를 공유한다. 둘 다 이미지 수명 관리라 나눌 이유가 없다. */
interface ThumbnailJob {
  storageKey?: string;
}

const DERIVE = 'derive';
const SWEEP = 'sweep-orphans';

/**
 * 썸네일 파생.
 *
 * **동기로 하지 않는 이유**는 등록 응답이 이미지 처리 시간만큼 늦어지기 때문이다.
 * 사진 15장을 올리는 시공자에게 그 지연은 그대로 이탈률이 된다.
 * 등록은 즉시 끝내고 파생은 큐가 가져간다. 클라이언트는 썸네일이 아직 null이면
 * 스켈레톤을 보여주면 된다.
 *
 * 목록 400px, 상세 1200px. **목록에서 원본을 절대 로드하지 않는다** —
 * 이 규칙 하나가 목록 성능의 대부분이다.
 *
 * 근거: brain/20-도메인/이미지 파이프라인.md · brain/30-설계/구조적 원칙.md 6조
 */
@Injectable()
export class ThumbnailQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ThumbnailQueue.name);
  private queue?: Queue<ThumbnailJob>;
  private worker?: Worker<ThumbnailJob>;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageAdapter,
  ) {}

  onModuleInit(): void {
    /*
     * 테스트에서는 Redis에 붙지 않는다. 큐가 없으면 enqueue가 조용히 넘어가고,
     * 파생은 안 되지만 등록 자체는 검증할 수 있다.
     */
    if (this.env.NODE_ENV === 'test') return;

    const connection = { url: this.env.REDIS_URL };
    this.queue = new Queue<ThumbnailJob>(QUEUE_NAME, { connection });
    this.worker = new Worker<ThumbnailJob>(
      QUEUE_NAME,
      async (job) => {
        if (job.name === SWEEP) {
          await this.onSweep();
          return;
        }
        if (job.data.storageKey) await this.derive(job.data.storageKey);
      },
      { connection, concurrency: 2 },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        { job: job?.name, storageKey: job?.data.storageKey, err: error },
        '작업 실패',
      );
    });

    /*
     * 고아 파일 정리를 10분마다 돌린다.
     * 스토리지에는 올라갔는데 등록 전에 창을 닫으면 파일만 남고,
     * 방치하면 아무도 안 보는 곳에서 비용이 늘어난다.
     */
    void this.queue.upsertJobScheduler(SWEEP, { every: 10 * 60 * 1000 }, { name: SWEEP });
  }

  /** 정리 실행부는 ImagesService에 있다. 순환 참조를 피하려고 콜백으로 받는다. */
  private onSweep: () => Promise<void> = async () => {};

  registerSweepHandler(handler: () => Promise<void>): void {
    this.onSweep = handler;
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueue(storageKey: string): Promise<void> {
    if (!this.queue) return;
    await this.queue.add(
      DERIVE,
      { storageKey },
      {
        /* 스토리지가 잠깐 흔들릴 수 있다. 지수 백오프로 재시도한다. */
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }

  /** 워커 본체. 테스트에서 직접 부를 수 있게 public 이다. */
  async derive(storageKey: string): Promise<void> {
    const original = await this.storage.readAll(storageKey);
    if (!original) {
      this.logger.warn({ storageKey }, '원본을 찾을 수 없어 파생을 건너뛴다');
      return;
    }

    const widths = [THUMBNAIL_LIST_WIDTH, THUMBNAIL_DETAIL_WIDTH];
    const keys: Record<number, string> = {};

    for (const width of widths) {
      /*
       * sharp는 기본적으로 메타데이터를 버린다. withMetadata()를 부르지 않는 것이
       * 곧 EXIF 제거다 — 사진에 박힌 집 좌표가 그대로 공개되면 심각한 사고다.
       * 클라이언트에서도 지우지만 서버가 마지막 방어선이다.
       */
      const derived = await sharp(original)
        .rotate() // EXIF 방향만 반영하고 나머지는 버린다
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();

      const key = thumbnailKey(storageKey, width);
      await this.storage.put(key, derived, 'image/webp');
      keys[width] = key;
    }

    const data = {
      thumb400Key: keys[THUMBNAIL_LIST_WIDTH],
      thumb1200Key: keys[THUMBNAIL_DETAIL_WIDTH],
    };

    /* 어느 테이블의 사진인지는 키 접두사로 안다. */
    if (storageKey.startsWith('reference/')) {
      await this.prisma.referenceImage.updateMany({ where: { storageKey }, data });
    } else {
      await this.prisma.portfolioImage.updateMany({ where: { storageKey }, data });
    }
  }
}
