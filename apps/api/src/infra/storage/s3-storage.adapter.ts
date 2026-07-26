import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable } from '@nestjs/common';

import type { PresignUploadCommand, PresignedUpload, StoragePort } from '@fitter/domain';

import { ENV, type Env } from '../../config/env';

/**
 * S3 호환 스토리지 어댑터.
 *
 * 개발은 MinIO, 운영은 Cloudflare R2다. **둘 다 S3 API라 이 파일이 그대로 돈다** —
 * 바뀌는 건 엔드포인트와 자격증명뿐이다. R2를 고른 이유는 egress가 무료라서이고,
 * 이미지 서비스에서 그게 비용의 급소다.
 *
 * 도메인은 이 파일을 모른다. StoragePort 만 안다.
 * 근거: brain/30-설계/구조적 원칙.md 2조 · brain/50-결정/ADR-001 - 기술 스택 선정.md
 */
@Injectable()
export class S3StorageAdapter implements StoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.bucket = env.STORAGE_BUCKET ?? 'fitter-images';
    this.client = new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT,
      /* MinIO는 가상 호스트 스타일 주소를 쓰지 않는다. R2도 경로 스타일로 동작한다. */
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY_ID ?? '',
        secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY ?? '',
      },
    });
  }

  async presignUpload(command: PresignUploadCommand): Promise<PresignedUpload> {
    const ttlSeconds = 300;
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: command.namespace,
        ContentType: command.contentType,
        /*
         * 서명에 크기를 묶는다. 이게 없으면 10MB로 신고하고 1GB를 올릴 수 있다.
         * 클라이언트 검증은 우회할 수 있으므로 서명 자체가 제약이어야 한다.
         */
        ContentLength: command.contentLength,
      }),
      { expiresIn: ttlSeconds },
    );

    return {
      url,
      storageKey: command.namespace,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    };
  }

  async presignDownload(storageKey: string, ttlSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      { expiresIn: ttlSeconds },
    );
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }));
      return true;
    } catch {
      return false;
    }
  }

  /** 실제 크기. 클라이언트가 신고한 값과 대조한다. */
  async contentLength(storageKey: string): Promise<number | null> {
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );
      return head.ContentLength ?? null;
    } catch {
      return null;
    }
  }

  /**
   * 앞부분만 읽는다.
   *
   * 매직 넘버 검증에 32바이트면 충분한데 10MB를 통째로 내려받으면
   * 등록 요청마다 그만큼의 대역폭과 메모리가 날아간다.
   */
  async readHead(storageKey: string, bytes: number): Promise<Uint8Array | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
          Range: `bytes=0-${bytes - 1}`,
        }),
      );
      const body = await res.Body?.transformToByteArray();
      return body ?? null;
    } catch {
      return null;
    }
  }

  /** 워커가 썸네일을 올릴 때 쓴다. */
  async put(storageKey: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async readAll(storageKey: string): Promise<Uint8Array | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );
      const body = await res.Body?.transformToByteArray();
      return body ?? null;
    } catch {
      return null;
    }
  }
}
