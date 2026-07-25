import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/coverage/**',
      /* Next.js가 생성하는 파일. 우리가 고칠 수 없고 gitignore 대상이다. */
      '**/next-env.d.ts',
      'docs/**',
      'design/**',
      'brain/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,

  {
    rules: {
      // 도메인 용어집·구조적 원칙을 코드로 강제하기 위한 최소 규칙만 둔다.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  /*
   * 구조적 원칙 1조 — 도메인을 프레임워크에서 분리한다.
   * brain/30-설계/구조적 원칙.md
   *
   * 패키지 경계만으로도 물리적으로 막히지만, 왜 막히는지를 에러 메시지로 알려주려고
   * 린트 규칙을 함께 둔다. 규칙이 아니라 강제가 되어야 스택을 바꿔도 도메인이 살아남는다.
   */
  {
    files: ['packages/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@nestjs/*',
                'next',
                'next/*',
                'react',
                'react-dom',
                'express',
                'prisma',
                '@prisma/*',
                'bullmq',
                'ioredis',
                'pino',
                'zod',
                '@aws-sdk/*',
              ],
              message:
                '도메인 레이어는 프레임워크와 인프라를 import 하지 않는다. 필요하면 ports/ 에 인터페이스를 정의하고 어댑터를 apps/api/src/infra 에 둔다. 근거: brain/30-설계/구조적 원칙.md 1·2조',
            },
          ],
        },
      ],
    },
  },

  /*
   * NestJS는 생성자 주입을 emitDecoratorMetadata 로 해석하고, 그러려면
   * 주입 대상이 **런타임에 남는 값 import**여야 한다.
   * consistent-type-imports 의 자동 수정이 이걸 `import type`으로 바꾸면
   * 메타데이터가 Object가 되어 DI가 깨진다 — 실제로 한 번 깨뜨렸다.
   *
   * 스타일 규칙이 동작을 바꾸면 규칙 쪽이 틀린 것이다. 여기서는 끈다.
   */
  {
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },

  /* QC 스크립트는 Node에서 직접 돈다. 빌드 대상이 아니다. */
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
      },
    },
  },

  /* 테스트 파일은 규칙을 조금 푼다. */
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/*.e2e-spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
