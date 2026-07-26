'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { PortfolioStatus } from '@fitter/shared';

import { ApiError, imageUrl } from '../../../../lib/api';
import { useSession } from '../../../../lib/session';

interface MyPortfolio {
  id: string;
  title: string | null;
  status: PortfolioStatus;
  viewCount: number;
  coverThumbKey: string | null;
  createdAt: string;
}

interface ProProfile {
  businessName: string;
  isApproved: boolean;
}

const STATUS_LABELS: Readonly<Record<PortfolioStatus, string>> = {
  DRAFT: '작성 중',
  PUBLISHED: '공개 중',
  HIDDEN: '숨김',
};

/**
 * 내 포트폴리오.
 *
 * **승인 상태를 맨 위에 띄운다.** 항목이 `PUBLISHED`인데도 갤러리에 안 보이는
 * 상황이 정상적으로 존재하고(공개 조건이 두 개다), 그 이유를 안 알려주면
 * 시공자는 서비스가 고장 났다고 판단한다.
 *
 * 근거: brain/20-도메인/엔티티 - PortfolioItem.md
 */
export default function MyPortfoliosPage() {
  const { user, loading, authFetch } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<MyPortfolio[] | null>(null);
  const [profile, setProfile] = useState<ProProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/portfolios/mine')}`);
      return;
    }
    if (user.profileType !== 'PRO') {
      router.replace('/');
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const [list, me] = await Promise.all([
          authFetch<{ items: MyPortfolio[] }>('/me/portfolios'),
          authFetch<ProProfile>('/me/pro-profile'),
        ]);
        if (!alive) return;
        setItems(list.items);
        setProfile(me);
      } catch (err) {
        if (alive) setError(err instanceof ApiError ? err.message : '불러오지 못했습니다.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [loading, user, authFetch, router]);

  if (loading || user?.profileType !== 'PRO') return null;

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-10) var(--space-4)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-6)',
        }}
      >
        <h1 className="t-h1">내 시공 사례</h1>
        <a href="/portfolios/new" role="button" className="btn btn--primary btn--md">
          새 사례
        </a>
      </div>

      {/*
        승인 대기 안내는 화면 하나가 아니라 배너로 흡수했다(시안 P0-2 판단).
        공개가 안 되는 이유가 여기 있다.

        문구를 고쳤다(2026-07-26). 전에는 "저장되지만 승인 전까지는 갤러리에 노출되지
        않습니다"라고 썼는데 **서버는 공개 자체를 막는다**(`publish` 는 승인된 시공자
        전용이라 403). 화면이 서버보다 무른 말을 하면 사용자는 눌러본 뒤에야 진실을 안다.
      */}
      {profile && !profile.isApproved && (
        <div className="mine__banner">
          <strong>승인 대기 중입니다.</strong> 승인 전에는 사례를 공개할 수 없습니다. 지금 비공개로
          올려두면 사진과 내용이 그대로 남고, 승인되는 즉시 공개할 수 있습니다.
        </div>
      )}

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
          <strong className="mine__empty-title">아직 올린 사례가 없습니다</strong>
          <p style={{ color: 'var(--color-text-secondary)', margin: 'var(--space-2) 0 0' }}>
            시공 전·후 사진 두 장이면 시작할 수 있습니다.
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
            <li
              key={item.id}
              style={{
                display: 'flex',
                gap: 'var(--space-4)',
                alignItems: 'center',
                padding: 'var(--space-4)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-surface)',
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-bg-sunken)',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                {imageUrl(item.coverThumbKey) && (
                  <img
                    src={imageUrl(item.coverThumbKey) ?? ''}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: 'block' }}>{item.title ?? '제목 없는 사례'}</strong>
                <span className="mine__status">
                  {STATUS_LABELS[item.status]}
                  {/* 공개했는데 승인이 없으면 실제로는 안 보인다. 그 사실을 여기서도 말한다. */}
                  {item.status === 'PUBLISHED' && profile && !profile.isApproved && ' · 승인 대기'}
                </span>
              </div>

              <span className="mine__count">조회 {item.viewCount}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
