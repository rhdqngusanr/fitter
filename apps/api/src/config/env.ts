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
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** 프론트 오리진. CORS 허용 목록. */
  WEB_ORIGIN: z.string().min(1).default('http://localhost:3000'),

  /* 아래는 해당 Phase에서 필수로 승격한다. */
  DATABASE_URL: z.string().min(1).optional(),
  STORAGE_BUCKET: z.string().min(1).optional(),
  STORAGE_ENDPOINT: z.string().min(1).optional(),
  STORAGE_ACCESS_KEY_ID: z.string().min(1).optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(1).optional(),
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
