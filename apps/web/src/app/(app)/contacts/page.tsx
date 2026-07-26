'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import type { ContactStatus } from '@fitter/shared';

import { StatusChip } from '../../../components/StatusChip';
import { ApiError } from '../../../lib/api';
import { useSession } from '../../../lib/session';

interface ContactRow {
  id: string;
  status: ContactStatus;
  message: string;
  proposedAmount: number | null;
  expiresAt: string | null;
  createdAt: string;
  counterpart: { id: string; nickname: string };
}

const BOXES = [
  { key: 'received', label: '받은 문의' },
  { key: 'sent', label: '보낸 문의' },
] as const;

/**
 * 컨택 목록 (M-01).
 *
 * **목록에서는 상태를 바꿀 수 없다.** 수락·거절은 상세에서만 일어난다.
 * 목록에 버튼을 달면 상대 메시지를 읽지 않고 누르게 되고, 수락은 되돌릴 수 없다.
 *
 * 근거: brain/20-도메인/상태머신 - 컨택.md · brain/30-설계/화면 목록.md
 */
export default function ContactsPage() {
  return (
    <Suspense fallback={null}>
      <ContactList />
    </Suspense>
  );
}

function ContactList() {
  const { user, loading, authFetch } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const box = params.get('box') === 'sent' ? 'sent' : 'received';

  const [items, setItems] = useState<ContactRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/contacts')}`);
      return;
    }
    let alive = true;
    setItems(null);
    void (async () => {
      try {
        const res = await authFetch<{ items: ContactRow[] }>(`/contacts?box=${box}`);
        if (alive) setItems(res.items);
      } catch (err) {
        if (alive) setError(err instanceof ApiError ? err.message : '불러오지 못했습니다.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [loading, user, box, authFetch, router]);

  if (loading || !user) return null;

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-10) var(--space-4)' }}>
      <h1 style={{ fontSize: 26, margin: '0 0 var(--space-6)' }}>문의</h1>

      <nav
        aria-label="함 선택"
        style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}
      >
        {BOXES.map((b) => {
          const on = box === b.key;
          return (
            <a
              key={b.key}
              href={`/contacts?box=${b.key}`}
              aria-current={on ? 'page' : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 40,
                padding: '0 var(--space-5)',
                borderRadius: 'var(--radius-full)',
                fontSize: 14,
                fontWeight: 600,
                background: on ? 'var(--color-primary-500)' : 'var(--color-surface)',
                color: on ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                border: `1px solid ${on ? 'var(--color-primary-500)' : 'var(--color-border)'}`,
              }}
            >
              {b.label}
            </a>
          );
        })}
      </nav>

      {error && (
        <p role="alert" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}

      {items === null ? null : items.length === 0 ? (
        <div
          style={{
            border: '1px dashed var(--color-border-strong)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-12) var(--space-6)',
            textAlign: 'center',
            background: 'var(--color-bg-subtle)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {box === 'received'
            ? '아직 받은 문의가 없습니다.'
            : '아직 보낸 문의가 없습니다. 마음에 드는 사례에서 문의를 보내보세요.'}
        </div>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gap: 'var(--space-3)',
          }}
        >
          {items.map((c) => (
            <li key={c.id}>
              <a
                href={`/contacts/${c.id}`}
                style={{
                  display: 'block',
                  padding: 'var(--space-5)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-surface)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  <strong>{c.counterpart.nickname}</strong>
                  <StatusChip status={c.status} />
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: 'var(--color-text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.message}
                </p>

                {/*
                  제안 금액은 목록에서도 보여준다. 받은 쪽이 제일 먼저 보고 싶어 하는 숫자다.
                  안 적었으면 아예 안 쓴다 — "미정"이라고 쓰면 안 적은 게 흠처럼 보인다.
                */}
                {c.proposedAmount !== null && (
                  <p
                    style={{
                      margin: 'var(--space-2) 0 0',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {c.proposedAmount.toLocaleString('ko-KR')}원 제안
                  </p>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
