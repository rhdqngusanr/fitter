'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { AuthShell, Field, FormError, SubmitButton, inputStyle } from '../../../components/form';
import { ApiError } from '../../../lib/api';
import { useSession } from '../../../lib/session';

/**
 * 로그인 (G-02).
 *
 * 액세스 토큰이 메모리에만 사는 구조라 이 화면은 클라이언트에서 돈다.
 * 근거: brain/50-결정/ADR-002 - 인증과 권한 모델.md
 */
export default function LoginPage() {
  /*
   * useSearchParams 를 쓰는 부분은 Suspense 안에 있어야 한다.
   * 정적 셸을 먼저 내보내고 쿼리스트링에 의존하는 부분만 브라우저에서 채운다.
   */
  return (
    <Suspense
      fallback={
        <AuthShell title="로그인" sub="불러오는 중…">
          {null}
        </AuthShell>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { login } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /*
   * 돌아갈 곳은 열린 리다이렉트가 되지 않게 내부 경로만 받는다.
   * `//evil.com` 도 브라우저는 외부로 읽으므로 슬래시 하나로 시작하는 것만 통과시킨다.
   */
  const raw = params.get('next') ?? '/';
  const next = /^\/(?!\/)/.test(raw) ? raw : '/';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      await login(String(data.get('email')), String(data.get('password')));
      router.push(next);
    } catch (err) {
      /*
       * 이메일이 없는 건지 비밀번호가 틀린 건지 구분해 주지 않는다.
       * 구분해 주면 어느 이메일이 가입돼 있는지 알려주는 조회 도구가 된다.
       * 서버도 같은 메시지를 주므로 여기서는 그대로 보여주기만 한다.
       */
      setError(err instanceof ApiError ? err.message : '로그인하지 못했습니다.');
      setPending(false);
    }
  }

  return (
    <AuthShell title="로그인" sub="사진을 올리거나 문의하려면 로그인이 필요합니다.">
      <FormError message={error} />
      <form onSubmit={onSubmit} noValidate>
        <Field label="이메일">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            style={inputStyle}
          />
        </Field>
        <Field label="비밀번호">
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            style={inputStyle}
          />
        </Field>
        <SubmitButton pending={pending}>로그인</SubmitButton>
      </form>

      <p
        style={{ marginTop: 'var(--space-6)', fontSize: 14, color: 'var(--color-text-secondary)' }}
      >
        아직 계정이 없으신가요?{' '}
        <a
          href={`/signup?next=${encodeURIComponent(next)}`}
          style={{ color: 'var(--color-primary-600)', fontWeight: 600 }}
        >
          가입하기
        </a>
      </p>
    </AuthShell>
  );
}
