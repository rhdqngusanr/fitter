import { z } from 'zod';

/**
 * 환경변수 스키마.
 *
 * 부팅 시점에 한 번 검증하고 실패하면 즉시 죽는다.
 * 런타임 한복판에서 undefined가 튀어나오는 것보다 뜨자마자 죽는 게 낫다.
 *
 * 값이 실제로 필요해지는 시점에 필수로 바꾼다. DATABASE_URL은 P3-1 ERD 이후,
 * 스토리지 관련은 P4-2 이미지 파이프라인 이후다. 지금 필수로 걸면 뼈대가 뜨지 않는다.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  /* silent는 테스트용이다. 로그가 시끄러우면 실패한 테스트가 묻힌다. */
  LOG_LEVEL: z.enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** 프론트 오리진. CORS 허용 목록. */
  WEB_ORIGIN: z.string().min(1).default('http://localhost:3000'),

  /**
   * P4-1에서 필수로 승격했다.
   * 짧은 시크릿은 서명을 무의미하게 만들므로 길이를 강제한다.
   */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET은 32자 이상이어야 합니다.'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL이 필요합니다.'),

  /* P4-2에서 필수로 승격했다. 개발은 MinIO, 운영은 Cloudflare R2. 둘 다 S3 API다. */
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ENDPOINT: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  /* R2는 지역 개념이 없어 'auto'를 쓴다. MinIO도 아무 값이나 받는다. */
  STORAGE_REGION: z.string().min(1).default('auto'),

  /* 썸네일 파생과 고아 파일 정리를 큐로 돌린다. */
  REDIS_URL: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`환경변수 검증에 실패했습니다.\n${issues}\n\n.env.example을 참고하세요.`);
  }

  return parsed.data;
}

/** DI 토큰. 문자열을 흩뿌리지 않고 여기 하나만 둔다. */
export const ENV = Symbol('ENV');
