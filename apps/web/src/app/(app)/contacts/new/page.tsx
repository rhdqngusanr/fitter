'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { AuthShell, Field, FormError, SubmitButton, inputStyle } from '../../../../components/form';
import { ApiError } from '../../../../lib/api';
import { useSession } from '../../../../lib/session';

/**
 * 문의 보내기.
 *
 * 방향이 둘이다. 고객이 포트폴리오를 보고 시공자에게 보내거나(CUSTOMER_TO_PRO),
 * 시공자가 의뢰를 보고 고객에게 보낸다(PRO_TO_REQUEST).
 * 어느 쪽인지는 어디서 왔는지로 정해진다 — 사용자에게 고르게 하지 않는다.
 *
 * 근거: brain/20-도메인/상태머신 - 컨택.md
 */
export default function NewContactPage() {
  return (
    <Suspense fallback={null}>
      <NewContactForm />
    </Suspense>
  );
}

function NewContactForm() {
  const { user, loading, authFetch } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const portfolioItemId = params.get('portfolioItemId');
  const referenceRequestId = params.get('referenceRequestId');
  const direction = portfolioItemId ? 'CUSTOMER_TO_PRO' : 'PRO_TO_REQUEST';
  const target = portfolioItemId ?? referenceRequestId;

  if (loading) return null;
  if (!user) {
    const here = `/contacts/new?${params.toString()}`;
    router.replace(`/login?next=${encodeURIComponent(here)}`);
    return null;
  }
  if (!target) {
    return (
      <AuthShell title="문의할 대상이 없습니다" sub="사례나 의뢰에서 문의 버튼을 눌러주세요.">
        <a href="/gallery" style={{ color: 'var(--color-primary-600)', fontWeight: 600 }}>
          시공 사례 보러 가기
        </a>
      </AuthShell>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const data = new FormData(event.currentTarget);
    const amount = String(data.get('proposedAmount') ?? '').trim();

    try {
      const created = await authFetch<{ id: string }>('/contacts', {
        method: 'POST',
        body: JSON.stringify({
          direction,
          ...(portfolioItemId ? { portfolioItemId } : { referenceRequestId }),
          message: String(data.get('message')),
          /*
           * 금액은 선택이다. 필수로 하면 "현장을 봐야 안다"는 정당한 경우를 막는다.
           * 그래도 받아두는 이유는 이게 2차 가격 통계의 유일한 데이터원이기 때문이다 —
           * 거래는 밖에서 성사돼도 제안은 안에서 일어난다.
           */
          ...(amount ? { proposedAmount: Number(amount) } : {}),
          ...(String(data.get('proposedAmountNote') ?? '').trim()
            ? { proposedAmountNote: String(data.get('proposedAmountNote')) }
            : {}),
        }),
      });
      router.push(`/contacts/${created.id}`);
    } catch (err) {
      /* 같은 상대에게 진행 중인 문의가 이미 있으면 서버가 막는다. DB에도 같은 제약이 있다. */
      setError(err instanceof ApiError ? err.message : '보내지 못했습니다.');
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="문의 보내기"
      sub={
        direction === 'CUSTOMER_TO_PRO'
          ? '이 시공자에게 어떤 공사를 원하는지 알려주세요.'
          : '이 의뢰에 어떻게 시공할지 알려주세요.'
      }
    >
      <FormError message={error} />
      <form onSubmit={onSubmit} noValidate>
        <Field label="메시지" hint="구체적일수록 답이 빨리 옵니다.">
          <textarea
            name="message"
            required
            rows={6}
            maxLength={2000}
            autoFocus
            placeholder="원하는 범위와 일정, 궁금한 점을 적어주세요."
            style={{
              ...inputStyle,
              height: 'auto',
              padding: 'var(--space-3) var(--space-4)',
              resize: 'vertical',
            }}
          />
        </Field>

        <Field label="제안 금액 (선택)" hint="현장을 봐야 안다면 비워두셔도 됩니다.">
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <input
              name="proposedAmount"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="원"
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              name="proposedAmountNote"
              type="text"
              maxLength={200}
              placeholder="예) 자재비 별도"
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        </Field>

        <SubmitButton pending={pending}>문의 보내기</SubmitButton>
        {/* 연락처가 언제 열리는지 미리 말한다. 기대와 다르면 그게 불신이 된다. */}
        <p
          style={{
            fontSize: 13,
            color: 'var(--color-text-tertiary)',
            marginTop: 'var(--space-3)',
            textAlign: 'center',
          }}
        >
          상대가 수락하면 서로의 연락처가 공개됩니다. 그 전에는 어느 쪽도 볼 수 없습니다.
        </p>
      </form>
    </AuthShell>
  );
}
