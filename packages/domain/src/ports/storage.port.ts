/**
 * 스토리지 포트.
 *
 * 구현은 Cloudflare R2(S3 호환)이지만 도메인은 그걸 모른다.
 * S3 → GCS → 자체 호스팅으로 바뀌어도 이 인터페이스는 그대로다.
 *
 * 근거: brain/30-설계/구조적 원칙.md 2조 · brain/20-도메인/이미지 파이프라인.md
 */

export interface PresignedUpload {
  /** 클라이언트가 직접 PUT 할 URL. 파일은 서버를 경유하지 않는다. */
  readonly url: string;
  /** 업로드 후 메타데이터 등록에 쓸 키. */
  readonly storageKey: string;
  readonly expiresAt: Date;
}

export interface PresignUploadCommand {
  readonly contentType: string;
  readonly contentLength: number;
  /** 'reference' | 'portfolio' 등 용도별 경로 분리에 쓴다. */
  readonly namespace: string;
}

export interface StoragePort {
  /** 서명 URL을 발급한다. 대역폭과 메모리를 아끼는 핵심 장치. */
  presignUpload(command: PresignUploadCommand): Promise<PresignedUpload>;

  /** 읽기용 서명 URL. 공개 버킷이면 구현체가 그냥 공개 URL을 돌려줘도 된다. */
  presignDownload(storageKey: string, ttlSeconds: number): Promise<string>;

  delete(storageKey: string): Promise<void>;

  /** 고아 파일 정리에 쓴다. 업로드는 됐지만 메타데이터가 등록되지 않은 것들. */
  exists(storageKey: string): Promise<boolean>;
}
