'use client';

import { useState } from 'react';

import { api, imageUrl, type GalleryItem, type GalleryResponse } from '../lib/api';

import { PhotoCard } from './ui/PhotoCard';

/**
 * 갤러리 그리드 + 더 보기.
 *
 * **시안(C-04)이 그린 8상태 중 "추가 로딩"이 이 컴포넌트의 존재 이유다** —
 * "기존 카드는 그대로 두고 아래에만 스켈레톤을 붙인다." 구현에는 다음 페이지를 불러올
 * 수단이 아예 없어서 첫 페이지 뒤의 사례를 볼 방법이 없었다.
 *
 * 첫 페이지는 서버가 그려서 넘겨준다. 이 컴포넌트가 클라이언트여도 초기 HTML 에는
 * 카드가 그대로 들어 있어서 **색인은 그대로 된다** — 갤러리가 유일한 유입 통로라
 * 이걸 잃으면 안 된다.
 *
 * 커서 페이지네이션이다. 오프셋은 쓰지 않는다 — 새 사례가 올라오면 페이지 경계가
 * 밀려서 같은 카드를 두 번 보거나 건너뛴다.
 */
export function GalleryGrid({
  initialItems,
  initialCursor,
  query,
}: {
  initialItems: GalleryItem[];
  initialCursor: string | null;
  /** 지금 걸린 필터. 다음 페이지도 같은 조건이어야 한다. */
  query: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    if (!cursor || pending) return;
    setPending(true);
    setFailed(false);
    try {
      const next = new URLSearchParams(query);
      next.set('cursor', cursor);
      const page = await api<GalleryResponse>(`/portfolios?${next.toString()}`);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      /*
       * 실패해도 이미 본 카드는 그대로 둔다. 목록을 비우고 에러를 띄우면
       * 스크롤해서 내려온 사람의 위치를 잃는다.
       */
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <ul className="gallery-grid">
        {items.map((item, index) => (
          <li key={item.id}>
            <PhotoCard
              href={`/gallery/${item.id}`}
              src={imageUrl(item.coverThumbKey)}
              alt={item.title}
              tag={item.categories[0]?.nameKo}
              count={item.photoCount}
              title={item.title}
              meta={metaLine(item)}
              /* 첫 줄만 즉시 불러온다. 처음 보이는 사진이 늦으면 그게 곧 체감 로딩 시간이다. */
              eager={index < 4}
              wide
            />
          </li>
        ))}
        {/* 시안: 추가 로딩은 기존 카드를 건드리지 않고 아래에만 스켈레톤을 붙인다. */}
        {pending &&
          Array.from({ length: 4 }, (_, i) => (
            <li key={`skeleton-${i}`} aria-hidden="true">
              <GridSkeletonCard />
            </li>
          ))}
      </ul>

      {pending ? (
        <span className="gallery-status">
          <span className="spinner spinner--dark" aria-hidden="true" />더 불러오는 중
        </span>
      ) : (
        cursor && (
          <button type="button" onClick={() => void loadMore()} className="gallery-more">
            {failed ? '다시 시도' : '더 보기'}
          </button>
        )
      )}

      {failed && (
        <span role="alert" className="gallery-error">
          다음 사례를 불러오지 못했습니다.
        </span>
      )}
    </div>
  );
}

/** 시안은 갤러리 카드 메타를 `성북구 24평 · 김도배` 로 쓴다. */
function metaLine(item: GalleryItem) {
  return [
    [item.region?.sigunguName, item.areaPyeong ? `${Number(item.areaPyeong)}평` : null]
      .filter(Boolean)
      .join(' '),
    item.pro.businessName,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** 카드와 같은 4:3 을 유지한다. 그래야 로딩이 끝날 때 그리드 높이가 튀지 않는다. */
export function GridSkeletonCard() {
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      <span
        className="skeleton"
        style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', borderRadius: 0 }}
      />
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '10px 12px 12px',
        }}
      >
        <span className="skeleton" style={{ display: 'block', height: 13, width: '80%' }} />
        <span className="skeleton" style={{ display: 'block', height: 11, width: '50%' }} />
      </span>
    </div>
  );
}
