'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { REQUEST_STATUS_LABELS, type RequestStatus } from '@fitter/shared';

import { ApiError, imageUrl } from '../../../../lib/api';
import { useSession } from '../../../../lib/session';

interface MyRequest {
  id: string;
  title: string | null;
  status: RequestStatus;
  contactCount: number;
  coverThumbKey: string | null;
  createdAt: string;
}

/**
 * 내 의뢰 목록.
 *
 * 의뢰를 올린 직후 도착하는 화면이라, **제안이 몇 건 왔는지**가 제일 위에 와야 한다.
 * 올리고 나서 아무 반응이 없으면 사람은 서비스가 고장 났다고 생각한다.
 */
export default function MyRequestsPage() {
  const { user, loading, authFetch } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<MyRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/requests/mine')}`);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const res = await authFetch<{ items: MyRequest[] }>('/me/reference-requests');
        if (alive) setItems(res.items);
      } catch (err) {
        if (alive) setError(err instanceof ApiError ? err.message : '불러오지 못했습니다.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [loading, user, authFetch, router]);

  if (loading || !user) return null;

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-10) var(--space-4)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-8)',
        }}
      >
        <h1 className="t-h1">내 의뢰</h1>
        <a href="/requests/new" role="button" className="btn btn--primary btn--md">
          새 의뢰
        </a>
      </div>

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
          }}
        >
          <strong className="mine__empty-title">아직 올린 의뢰가 없습니다</strong>
          <p style={{ color: 'var(--color-text-secondary)', margin: 'var(--space-2) 0 0' }}>
            원하는 분위기의 사진 한 장이면 시작할 수 있습니다.
          </p>
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
          {items.map((item) => (
            <li key={item.id}>
              {/*
                **카드 전체가 상세(C-03)로 가는 링크다.** 전에는 목록이 어디로도
                이어지지 않아서 받은 제안을 비교할 방법이 없었고, 의뢰를 마감할
                방법도 없었다(API 는 있는데 부르는 화면이 없었다).
              */}
              <Link href={`/requests/${item.id}`} className="mine-card">
                <div className="mine-card__thumb">
                  {imageUrl(item.coverThumbKey) && (
                    <img src={imageUrl(item.coverThumbKey) ?? ''} alt="" />
                  )}
                </div>

                <div className="mine-card__body">
                  <strong className="mine-card__title">{item.title ?? '제목 없는 의뢰'}</strong>
                  <span className="mine__status">{REQUEST_STATUS_LABELS[item.status]}</span>
                </div>

                {/* 올리고 나서 제일 궁금한 숫자다. 0이어도 보여준다 — 없는 것과 모르는 건 다르다. */}
                <span
                  className="mine__count"
                  style={{
                    fontWeight: 600,
                    color:
                      item.contactCount > 0
                        ? 'var(--color-primary-600)'
                        : 'var(--color-text-tertiary)',
                  }}
                >
                  제안 {item.contactCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
