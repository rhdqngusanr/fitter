import { Global, Module } from '@nestjs/common';

import { S3StorageAdapter } from './s3-storage.adapter';

/**
 * 스토리지 주입 지점.
 *
 * 구현체를 바꿔도(MinIO → R2 → S3) 호출부는 모른다.
 * 어댑터가 StoragePort 보다 넓은 메서드를 몇 개 더 가지므로
 * 클래스 자체를 주입한다 — 인프라 계층 안에서만 쓰는 것들이다.
 */
@Global()
@Module({
  providers: [S3StorageAdapter],
  exports: [S3StorageAdapter],
})
export class StorageModule {}
