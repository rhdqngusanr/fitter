'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { AuthShell, Field, FormError, SubmitButton } from '../../../components/form';
import { ApiError } from '../../../lib/api';
import { useSession } from '../../../lib/session';

/** 서버 스키마와 같은 값. 여기서 다시 정하면 두 쪽이 갈라진다. */
const MIN_PASSWORD = 10;

/**
 * 회원가입 (G-02).
 *
 * 가입 직후에는 역할이 없다. 역할 선택은 별도 화면(G-03)이고,
 * 가입 시점에 강요하면 "일단 둘러보려던" 사람을 여기서 잃는다.
 */
export default function SignupPage() {
  /* useSearchParams 를 쓰는 부분은 Suspense 안에 있어야 정적 셸을 먼저 내보낼 수 있다. */
  return (
    <Suspense
      fallback={
        <AuthShell title="시작하기" sub="불러오는 중…">
          {null}
        </AuthShell>
      }
    >
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const { signup } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const raw = params.get('next') ?? '/';
  const next = /^\/(?!\/)/.test(raw) ? raw : '/';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      await signup({
        email: String(data.get('email')),
        password: String(data.get('password')),
        nickname: String(data.get('nickname')),
        agreedToTerms: true,
      });
      /* 역할을 아직 안 골랐으니 온보딩으로 보낸다. 돌아갈 곳은 거기서 이어받는다. */
      router.push(`/onboarding?next=${encodeURIComponent(next)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '가입하지 못했습니다.');
      setPending(false);
    }
  }

  return (
    <AuthShell title="시작하기" sub="사진을 올리는 데 30초면 충분합니다.">
      <FormError message={error} />
      <form onSubmit={onSubmit} noValidate>
        <Field label="이메일">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            className="input"
          />
        </Field>
        <Field label="닉네임" hint="문의를 받을 때 상대에게 보이는 이름입니다.">
          <input
            name="nickname"
            type="text"
            required
            maxLength={30}
            autoComplete="nickname"
            className="input"
          />
        </Field>
        {/*
          비밀번호는 길이만 본다. 특수문자를 강제하면 사람을 예측 가능한 패턴으로 몰아
          오히려 약해진다. 서버 스키마와 같은 판단이다.
        */}
        <Field label="비밀번호" hint={`${MIN_PASSWORD}자 이상. 길수록 안전합니다.`}>
          <input
            name="password"
            type="password"
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            className="input"
          />
        </Field>

        {/*
          약관 동의는 체크박스로 명시적으로 받는다. 서버도 true 만 통과시킨다.
          "가입하면 동의한 것으로 봅니다" 식은 동의를 받았다고 보기 어렵다.
        */}
        <label className="upload__consent" style={{ margin: '0 0 var(--space-6)' }}>
          <input name="agreedToTerms" type="checkbox" required style={{ marginTop: 3 }} />
          <span>이용약관과 개인정보 처리방침에 동의합니다.</span>
        </label>

        <SubmitButton pending={pending}>가입하고 시작하기</SubmitButton>
      </form>

      <p className="auth__foot">
        이미 계정이 있으신가요?{' '}
        <a
          href={`/login?next=${encodeURIComponent(next)}`}
          style={{ color: 'var(--color-primary-600)', fontWeight: 600 }}
        >
          로그인
        </a>
      </p>
    </AuthShell>
  );
}
