'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ContactStatus } from '@fitter/shared';

import { ApiError } from '../../../../lib/api';
import { useSession } from '../../../../lib/session';
import { StatusChip } from '../../../../components/StatusChip';

interface ContactDetail {
  id: string;
  status: ContactStatus;
  message: string;
  proposedAmount: number | null;
  proposedAmountNote: string | null;
  declineReason: string | null;
  expiresAt: string | null;
  createdAt: string;
  requesterUserId: string;
  receiverUserId: string;
  counterpart: {
    id: string;
    nickname: string;
    /** ACCEPTED이고 당사자일 때만 이 키가 존재한다. 아니면 키 자체가 없다. */
    phone?: string;
  };
}

/**
 * 컨택 상세 (M-02).
 *
 * **연락처는 여기서만 나온다.** 수락된 컨택의 당사자에게만, 서버가 판단해서 준다.
 * 화면은 `phone` 키가 있는지 없는지만 본다 — 화면이 공개 여부를 판단하지 않는다.
 * 판단이 두 곳에 있으면 언젠가 갈라지고, 갈라지는 순간 연락처가 샌다.
 *
 * 근거: brain/30-설계/권한 모델.md · brain/20-도메인/상태머신 - 컨택.md
 */
export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading, authFetch } = useSession();
  const router = useRouter();

  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    const res = await authFetch<ContactDetail>(`/contacts/${id}`);
    setContact(res);
  }, [authFetch, id]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(`/contacts/${id}`)}`);
      return;
    }
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.message : '불러오지 못했습니다.');
    });
  }, [loading, user, id, load, router]);

  if (loading || !user || !contact) {
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-10) var(--space-4)' }}>
        {error && (
          <p role="alert" style={{ color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}
      </main>
    );
  }

  /*
   * 누가 무엇을 할 수 있는지는 서버가 최종 판단한다. 화면은 버튼을 감출 뿐이다.
   * 감추는 이유는 보안이 아니라 친절이다 — 누를 수 없는 버튼을 보여줄 이유가 없다.
   */
  const isReceiver = user.id === contact.receiverUserId;
  const isRequester = user.id === contact.requesterUserId;
  const open = contact.status === 'REQUESTED';

  async function act(path: string, body?: unknown) {
    setError(null);
    setPending(true);
    try {
      await authFetch(`/contacts/${id}/${path}`, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '처리하지 못했습니다.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-10) var(--space-4)' }}>
      <nav style={{ marginBottom: 'var(--space-6)', fontSize: 14 }}>
        <a href="/contacts" style={{ color: 'var(--color-text-secondary)' }}>
          ← 문의 목록
        </a>
      </nav>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <h1 style={{ fontSize: 24, margin: 0 }}>{contact.counterpart.nickname}</h1>
        <StatusChip status={contact.status} />
      </div>

      {error && (
        <p
          role="alert"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-5)',
          }}
        >
          {error}
        </p>
      )}

      <section
        style={{
          padding: 'var(--space-5)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--space-5)',
        }}
      >
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{contact.message}</p>

        {contact.proposedAmount !== null && (
          <p style={{ margin: 'var(--space-4) 0 0', fontWeight: 600 }}>
            {contact.proposedAmount.toLocaleString('ko-KR')}원 제안
            {contact.proposedAmountNote && (
              <span
                style={{
                  fontWeight: 400,
                  fontSize: 14,
                  color: 'var(--color-text-tertiary)',
                  marginLeft: 'var(--space-2)',
                }}
              >
                {contact.proposedAmountNote}
              </span>
            )}
          </p>
        )}

        {/* 만료가 있는 동안만 남은 기한을 보여준다. 지나면 상태 칩이 이미 말해준다. */}
        {open && contact.expiresAt && (
          <p
            style={{
              margin: 'var(--space-4) 0 0',
              fontSize: 13,
              color: 'var(--color-text-tertiary)',
            }}
          >
            {new Date(contact.expiresAt).toLocaleDateString('ko-KR')}까지 답하지 않으면 자동으로
            기간이 지납니다.
          </p>
        )}

        {contact.declineReason && (
          <p
            style={{
              margin: 'var(--space-4) 0 0',
              fontSize: 14,
              color: 'var(--color-text-secondary)',
            }}
          >
            거절 사유 — {contact.declineReason}
          </p>
        )}
      </section>

      {/*
        연락처는 키가 있는지로만 판단한다. 없으면 없는 것이다.
        마스킹된 값을 받아서 화면이 가리는 구조가 아니다.
      */}
      {contact.counterpart.phone ? (
        <section
          style={{
            padding: 'var(--space-5)',
            border: '1px solid var(--color-success)',
            background: 'var(--color-success-bg)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--space-5)',
          }}
        >
          <p style={{ margin: '0 0 var(--space-2)', fontSize: 13, color: 'var(--color-success)' }}>
            연락처가 공개됐습니다
          </p>
          <a
            href={`tel:${contact.counterpart.phone}`}
            onClick={() => void authFetch(`/contacts/${id}/view-contact`, { method: 'POST' })}
            style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}
          >
            {contact.counterpart.phone}
          </a>
        </section>
      ) : (
        contact.status === 'ACCEPTED' && (
          <p
            style={{
              color: 'var(--color-text-tertiary)',
              fontSize: 14,
              marginBottom: 'var(--space-5)',
            }}
          >
            상대가 연락처를 등록하지 않았습니다.
          </p>
        )
      )}

      {open && (
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          {/* 수락은 받은 사람만. 도메인 전이 함수가 같은 규칙을 강제한다. */}
          {isReceiver && (
            <>
              <Action onClick={() => void act('accept')} pending={pending} tone="primary">
                수락하고 연락처 교환
              </Action>
              <Action
                onClick={() => {
                  const reason = window.prompt('거절 사유를 남기시겠어요? (선택)') ?? undefined;
                  void act('decline', reason ? { reason } : undefined);
                }}
                pending={pending}
                tone="quiet"
              >
                거절
              </Action>
            </>
          )}
          {/* 취소는 보낸 사람만. */}
          {isRequester && (
            <Action onClick={() => void act('cancel')} pending={pending} tone="quiet">
              문의 취소
            </Action>
          )}
        </div>
      )}
    </main>
  );
}

function Action({
  onClick,
  pending,
  tone,
  children,
}: {
  onClick: () => void;
  pending: boolean;
  tone: 'primary' | 'quiet';
  children: React.ReactNode;
}) {
  const primary = tone === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      style={{
        flex: primary ? 2 : 1,
        height: 48,
        borderRadius: 'var(--radius-md)',
        fontSize: 15,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: pending ? 'default' : 'pointer',
        background: primary
          ? pending
            ? 'var(--color-primary-300)'
            : 'var(--color-primary-500)'
          : 'var(--color-surface)',
        color: primary ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
        border: primary ? 'none' : '1px solid var(--color-border-strong)',
      }}
    >
      {children}
    </button>
  );
}
