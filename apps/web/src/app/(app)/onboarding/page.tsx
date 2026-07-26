'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { ApiError } from '../../../lib/api';
import { useSession } from '../../../lib/session';
import { FormError } from '../../../components/form';

/**
 * 역할 선택 온보딩 (G-03).
 *
 * 계정당 역할은 하나다([[열린 질문]] Q2 해결). 그래서 이 선택은 되돌리기 어렵고,
 * 화면도 그 무게에 맞춰 두 갈래를 나란히 보여준 뒤 한 번 더 확인시킨다.
 *
 * 근거: brain/50-결정/ADR-002 - 인증과 권한 모델.md 결정 2
 */
const CHOICES = [
  {
    type: 'CUSTOMER' as const,
    title: '공사를 맡기려고 왔어요',
    body: '원하는 분위기의 사진을 올리면 그 스타일을 시공해 본 사람이 찾아옵니다.',
    note: '바로 시작할 수 있습니다.',
  },
  {
    type: 'PRO' as const,
    title: '시공을 하는 사람이에요',
    body: '내 작업 사진을 올려두면 그 사진을 보고 고객이 먼저 문의합니다.',
    /* 승인 게이트를 미리 알린다. 나중에 알면 속았다고 느낀다. */
    note: '포트폴리오 공개에는 관리자 승인이 필요합니다.',
  },
];

export default function OnboardingPage() {
  /* useSearchParams 를 쓰는 부분은 Suspense 안에 있어야 정적 셸을 먼저 내보낼 수 있다. */
  return (
    <Suspense fallback={null}>
      <RolePicker />
    </Suspense>
  );
}

function RolePicker() {
  const { user, loading, selectProfile } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [picked, setPicked] = useState<'CUSTOMER' | 'PRO' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const raw = params.get('next') ?? '/';
  const next = /^\/(?!\/)/.test(raw) ? raw : '/';

  /* 비로그인이면 로그인으로, 이미 역할이 있으면 되돌아간다. 이 화면은 한 번만 본다. */
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent('/onboarding')}`);
    else if (user.profileType) router.replace(next);
  }, [loading, user, next, router]);

  if (loading || !user || user.profileType) return null;

  async function confirm() {
    if (!picked) return;
    setError(null);
    setPending(true);
    try {
      await selectProfile(picked);
      router.replace(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '역할을 저장하지 못했습니다.');
      setPending(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-16) var(--space-4)' }}>
      <h1 style={{ fontSize: 26, margin: '0 0 var(--space-2)' }}>어떻게 오셨나요?</h1>
      <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 var(--space-8)' }}>
        계정 하나에 역할은 하나입니다. 나중에 바꾸려면 문의가 필요하니 신중히 골라주세요.
      </p>

      <FormError message={error} />

      <div
        style={{
          display: 'grid',
          gap: 'var(--space-4)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          marginBottom: 'var(--space-8)',
        }}
      >
        {CHOICES.map((choice) => {
          const on = picked === choice.type;
          return (
            <button
              key={choice.type}
              type="button"
              onClick={() => setPicked(choice.type)}
              aria-pressed={on}
              style={{
                textAlign: 'left',
                padding: 'var(--space-6)',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: on ? 'var(--color-primary-50)' : 'var(--color-surface)',
                border: `2px solid ${on ? 'var(--color-primary-500)' : 'var(--color-border)'}`,
              }}
            >
              <strong style={{ display: 'block', fontSize: 17, marginBottom: 'var(--space-2)' }}>
                {choice.title}
              </strong>
              <span
                style={{
                  display: 'block',
                  fontSize: 14,
                  color: 'var(--color-text-secondary)',
                  marginBottom: 'var(--space-3)',
                }}
              >
                {choice.body}
              </span>
              <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                {choice.note}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => void confirm()}
        disabled={!picked || pending}
        style={{
          width: '100%',
          height: 48,
          borderRadius: 'var(--radius-md)',
          border: 'none',
          fontSize: 16,
          fontWeight: 600,
          fontFamily: 'inherit',
          color: 'var(--color-text-inverse)',
          background: !picked || pending ? 'var(--color-primary-300)' : 'var(--color-primary-500)',
          cursor: !picked || pending ? 'default' : 'pointer',
        }}
      >
        {pending ? '저장 중…' : picked ? '이 역할로 시작하기' : '역할을 골라주세요'}
      </button>
    </main>
  );
}
