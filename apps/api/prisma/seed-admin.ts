import { PrismaClient } from '@prisma/client';

import { ScryptPasswordHasher } from '../src/infra/security/scrypt-password-hasher';

/**
 * 관리자 계정 생성.
 *
 * **ADMIN 은 가입 경로가 없다** — `POST /me/profile` 이 CUSTOMER/PRO 만 받는다.
 * 그런데 시드에도 없어서 **A-01·A-02 화면을 만들기 전까지 ADMIN 을 만들 방법이
 * 아예 없었다.** 이 스크립트가 그 구멍이다.
 *
 * 비밀번호는 **실행 인자로만** 받는다. 파일에 적어두지 않는다 —
 * 데모 시드가 시공자 계정의 `passwordHash` 를 일부러 null 로 두는 것과 같은 이유다.
 * 저장소에 있는 비밀번호는 뒷문이다.
 *
 * `process.env` 로도 받게 했다가 `pnpm qc` 가 잡았다 —
 * **검증되지 않은 환경변수를 읽는 곳은 `config/env.ts` 하나여야 한다**(CLAUDE.md).
 * 인자로 충분하므로 통로를 하나로 줄였다. 규칙에 예외를 내는 것보다 낫다.
 *
 * ```
 * pnpm --filter @fitter/api exec tsx prisma/seed-admin.ts admin@fitter.local '비밀번호'
 * ```
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [, , email, password] = process.argv;

  if (!email || !password) {
    throw new Error('사용법: tsx prisma/seed-admin.ts <email> <password>');
  }
  if (password.length < 10) {
    /* 관리자 계정이다. 약한 비밀번호를 허용할 이유가 없다. */
    throw new Error('관리자 비밀번호는 10자 이상이어야 합니다.');
  }

  const passwordHash = await new ScryptPasswordHasher().hash(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, nickname: '운영자', passwordHash },
    select: { id: true },
  });

  /*
   * 프로필은 하나만 둔다. 이미 CUSTOMER/PRO 로 쓰던 계정을 ADMIN 으로 바꾸면
   * 권한이 겹쳐 판단이 흐려진다 — 그럴 땐 다른 이메일을 쓰라고 막는다.
   */
  const existing = await prisma.userProfile.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { type: true },
  });
  if (existing && existing.type !== 'ADMIN') {
    throw new Error(
      `이 계정은 이미 ${existing.type} 입니다. 관리자는 별도 이메일로 만들어 주세요.`,
    );
  }
  if (!existing) {
    await prisma.userProfile.create({ data: { userId: user.id, type: 'ADMIN' } });
  }

  console.log(`관리자 준비 완료: ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
