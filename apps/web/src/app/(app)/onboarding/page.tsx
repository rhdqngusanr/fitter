'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { ApiError } from '../../../lib/api';
import { useSession } from '../../../lib/session';
import { FormError } from '../../../components/form';

/**
 * 역할 선택 온보딩 (G-03).
 *
 * 계정당 역할은 하나다([[열린 질문]] Q2 해결). **되돌리기 어려운 선택이므로
 * 고르기 전에 무슨 일이 벌어지는지 다 말한다** — 각 역할이 뭘 하게 되는지 세 줄,
 * 바로 다음에 어떤 화면으로 가는지, 그리고 시공자는 승인 심사가 있다는 것까지.
 *
 * 카드 두 장 외에 아무것도 두지 않는다. 여기서 고민이 길어지면 이탈한다.
 *
 * 근거: design/G-03 역할 선택 온보딩.dc.html · brain/50-결정/ADR-002 - 인증과 권한 모델.md
 */
const CHOICES = [
  {
    type: 'CUSTOMER' as const,
    title: '고객으로 시작',
    subtitle: '내 집을 고치려고 왔습니다',
    bullets: [
      '원하는 사진을 올려 의뢰를 등록한다',
      '시공자 포트폴리오를 보고 직접 문의한다',
      '받은 제안을 비교해 한 명을 고른다',
    ],
    next: '다음 화면: 의뢰 등록 (사진 3장이면 3분)',
    caution: null,
  },
  {
    type: 'PRO' as const,
    title: '시공자로 시작',
    subtitle: '시공 일감을 받으려고 왔습니다',
    bullets: [
      '내 시공 사진을 포트폴리오로 올린다',
      '조건에 맞는 의뢰를 찾아 제안한다',
      '고객 문의를 받고 수락하면 연락한다',
    ],
    next: '다음 화면: 프로필 등록 → 승인 심사',
    /* 승인 게이트를 고르기 전에 말한다. 고른 뒤에 알면 속았다고 느낀다. */
    caution: '사업자등록증 또는 시공 경력 확인이 필요합니다. 승인은 보통 1영업일.',
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

  /*
   * 이 화면을 떠나는 모든 경로가 여기 하나에 모여 있다.
   *
   * 역할 선택 직후에도 이 훅이 돈다(`user.profileType` 이 채워지므로).
   * 그래서 confirm 쪽에서 따로 이동시키면 이 훅이 그걸 덮어쓴다 —
   * 실제로 시공자를 고른 사람이 포트폴리오 등록이 아니라 홈으로 튕겼다.
   * 이동은 한 곳에서만 한다.
   */
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/onboarding')}`);
      return;
    }
    if (user.profileType) {
      /* 카드에 적어둔 "다음 화면"과 같은 곳으로 보낸다. 말한 것과 다른 데로 가면 안 된다. */
      const landing = user.profileType === 'PRO' ? '/portfolios/new' : '/requests/new';
      router.replace(next === '/' ? landing : next);
    }
  }, [loading, user, next, router]);

  if (loading || !user || user.profileType) return null;

  async function confirm() {
    if (!picked) return;
    setError(null);
    setPending(true);
    try {
      /* 저장만 한다. 이동은 위의 useEffect 가 맡는다 — 두 곳에서 하면 서로 덮어쓴다. */
      await selectProfile(picked);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '역할을 저장하지 못했습니다.');
      setPending(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: 'var(--space-12) var(--space-4)' }}>
      <h1 style={{ fontSize: 26, margin: '0 0 var(--space-2)', fontWeight: 800 }}>
        어느 쪽으로 시작하시겠어요?
      </h1>
      <p
        style={{
          color: 'var(--color-text-secondary)',
          margin: '0 0 var(--space-8)',
          lineHeight: 1.7,
        }}
      >
        고른 역할에 맞춰 첫 화면과 메뉴가 달라집니다. 계정당 하나만 고를 수 있습니다.
      </p>

      <FormError message={error} />

      {/* 라디오 그룹이다. 둘 중 하나만 고를 수 있다는 걸 스크린리더도 알아야 한다. */}
      <div
        role="radiogroup"
        aria-label="역할"
        style={{
          display: 'grid',
          gap: 'var(--space-4)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          marginBottom: 'var(--space-5)',
        }}
      >
        {CHOICES.map((choice) => {
          const on = picked === choice.type;
          return (
            <button
              key={choice.type}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPicked(choice.type)}
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                padding: 18,
                borderRadius: 'var(--radius-lg)',
                border: `1px solid ${on ? 'var(--color-primary-500)' : 'var(--color-border)'}`,
                background: on ? 'var(--color-primary-50)' : 'var(--color-bg)',
                fontFamily: 'inherit',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                }}
              >
                <span
                  style={{
                    fontSize: 19,
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {choice.title}
                </span>
                {/* 라디오 점. 눌린 게 뭔지 색만으로 알리지 않는다 — 색각 이상에서도 보여야 한다. */}
                <span
                  aria-hidden="true"
                  style={{
                    width: 24,
                    height: 24,
                    flex: '0 0 auto',
                    borderRadius: 'var(--radius-full)',
                    border: `2px solid ${on ? 'var(--color-primary-500)' : 'var(--color-border-strong)'}`,
                    background: on ? 'var(--color-primary-500)' : 'var(--color-bg)',
                    boxShadow: on ? 'inset 0 0 0 4px var(--color-bg)' : 'none',
                  }}
                />
              </span>

              <span style={{ fontSize: 15, color: 'var(--color-text-secondary)' }}>
                {choice.subtitle}
              </span>

              <span
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 7,
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: 'var(--space-3)',
                }}
              >
                {choice.bullets.map((bullet) => (
                  <span
                    key={bullet}
                    style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        flex: '0 0 auto',
                        width: 5,
                        height: 5,
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--color-primary-400)',
                        marginTop: 8,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {bullet}
                    </span>
                  </span>
                ))}
              </span>

              {/* 고르기 전에 다음 화면을 알려준다. 뭘 하게 될지 알고 고르는 게 낫다. */}
              <span
                style={{
                  display: 'inline-flex',
                  width: 'fit-content',
                  alignItems: 'center',
                  height: 26,
                  padding: '0 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg-subtle)',
                  color: 'var(--color-text-tertiary)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {choice.next}
              </span>

              {choice.caution && (
                <span
                  style={{
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: 'var(--color-warning)',
                  }}
                >
                  {choice.caution}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/*
        되돌릴 수 없다는 사실을 버튼 바로 위에 둔다.
        설명 문단에 섞어두면 안 읽는다 — 결정하기 직전에 보여야 한다.
      */}
      <div
        style={{
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          marginBottom: 'var(--space-5)',
        }}
      >
        <strong style={{ fontSize: 13, fontWeight: 800 }}>
          한 번 고르면 스스로 바꿀 수 없습니다
        </strong>
        <span style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--color-text-secondary)' }}>
          잘못 고르셨다면 설정에서 전환을 요청하세요. 확인 후 하루 안에 바꿔드립니다.
        </span>
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
          fontWeight: 700,
          fontFamily: 'inherit',
          color: 'var(--color-text-inverse)',
          background: !picked || pending ? 'var(--color-primary-300)' : 'var(--color-primary-500)',
          cursor: !picked || pending ? 'default' : 'pointer',
        }}
      >
        {pending ? '저장 중…' : picked ? '이 역할로 시작하기' : '역할을 하나 골라주세요'}
      </button>

      {/* 버튼이 왜 잠겼는지 말한다. 잠긴 이유를 모르면 사람은 화면을 떠난다. */}
      {!picked && (
        <p
          style={{
            margin: 'var(--space-2) 0 0',
            fontSize: 13,
            color: 'var(--color-text-tertiary)',
            textAlign: 'center',
          }}
        >
          역할을 선택해 주세요
        </p>
      )}
    </main>
  );
}
