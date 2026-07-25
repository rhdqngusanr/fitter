import type { Metadata } from 'next';

import { WORK_CATEGORY_SEEDS } from '@fitter/shared';

import { api, imageUrl, type GalleryResponse } from '../../../lib/api';

export const metadata: Metadata = {
  title: '시공 사례',
  description: '실제 시공자가 올린 작업 사진을 공종과 지역으로 찾아보세요.',
};

/** 목록은 항상 최신이어야 한다. 새 포트폴리오가 몇 분씩 안 보이면 시공자가 이탈한다. */
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ categories?: string; regions?: string }>;
}

/**
 * 포트폴리오 갤러리 (C-04).
 *
 * **비로그인 공개이고 SSR로 색인된다.** 포트폴리오 사진은 시공자 본인의 작업물이라
 * 공개 권리를 확보할 수 있고, 여기가 콜드스타트를 뚫을 유일한 유입 통로다.
 *
 * 근거: brain/30-설계/화면 목록.md · brain/10-제품/리스크 - 콜드스타트.md
 */
export default async function GalleryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const selected = params.categories?.split(',').filter(Boolean) ?? [];

  const query = new URLSearchParams();
  if (params.categories) query.set('categories', params.categories);
  if (params.regions) query.set('regions', params.regions);

  let data: GalleryResponse;
  try {
    data = await api<GalleryResponse>(`/portfolios?${query.toString()}`, { revalidate: 0 });
  } catch {
    return (
      <Main>
        <EmptyState
          title="목록을 불러오지 못했습니다"
          body="잠시 후 다시 시도해 주세요."
          action={{ href: '/gallery', label: '다시 시도' }}
        />
      </Main>
    );
  }

  const isFiltered = selected.length > 0 || !!params.regions;

  return (
    <Main>
      <header style={{ marginBottom: 'var(--space-8)' }}>
        {/*
          콘텐츠가 0건이면 히어로 카피까지 모집 모드로 바뀐다.
          시안 검수 7번 — 화면이 자기모순에 빠지지 않게 한다.
        */}
        <h1 style={{ fontSize: 28, margin: 0 }}>
          {data.hasAnyContent ? '시공 사례' : '첫 시공 사례를 기다립니다'}
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
          {data.hasAnyContent
            ? '마음에 드는 사진을 고르면 그 시공자에게 바로 문의할 수 있습니다.'
            : '시공자로 가입하면 첫 번째로 사례를 보여줄 수 있습니다.'}
        </p>
      </header>

      {data.hasAnyContent && <CategoryFilter selected={selected} />}

      {data.items.length === 0 ? (
        /*
         * 빈 상태를 두 갈래로 나눈다.
         * "필터 때문에 0건"과 "아직 아무것도 없어서 0건"은 완전히 다른 화면이다.
         * 시안 검수 6번이 지적한 지점이고, API가 hasAnyContent 로 알려준다.
         */
        isFiltered && data.hasAnyContent ? (
          <EmptyState
            title="조건에 맞는 사례가 없습니다"
            body="공종을 넓혀보면 다른 사례를 볼 수 있습니다."
            action={{ href: '/gallery', label: '필터 초기화' }}
          />
        ) : (
          <EmptyState
            title="아직 등록된 사례가 없습니다"
            body="시공자로 가입하면 첫 번째로 사례를 보여줄 수 있습니다. 지금 올린 사진이 가장 먼저 노출됩니다."
            action={{ href: '/signup', label: '시공자로 시작하기' }}
          />
        )
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gap: 'var(--space-5)',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          }}
        >
          {data.items.map((item) => (
            <li key={item.id}>
              <a
                href={`/gallery/${item.id}`}
                style={{
                  display: 'block',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  background: 'var(--color-surface)',
                }}
              >
                <div
                  style={{
                    aspectRatio: '4 / 3',
                    background: 'var(--color-bg-sunken)',
                    position: 'relative',
                  }}
                >
                  {imageUrl(item.coverThumbKey) && (
                    /*
                     * next/image 를 쓰지 않는다. 이미 400px 썸네일로 파생해 둔 이미지라
                     * 최적화 서버를 한 번 더 태울 이유가 없다. 원본은 목록에 오지 않는다.
                     */
                    <img
                      src={imageUrl(item.coverThumbKey) ?? ''}
                      alt={item.title}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  )}
                  {item.photoCount > 1 && (
                    <span
                      style={{
                        position: 'absolute',
                        right: 'var(--space-2)',
                        bottom: 'var(--space-2)',
                        background: 'var(--color-scrim)',
                        color: 'var(--color-text-inverse)',
                        borderRadius: 'var(--radius-full)',
                        padding: '2px 10px',
                        fontSize: 12,
                      }}
                    >
                      사진 {item.photoCount}
                    </span>
                  )}
                </div>

                <div style={{ padding: 'var(--space-4)' }}>
                  <strong style={{ display: 'block', marginBottom: 'var(--space-1)' }}>
                    {item.title}
                  </strong>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {[
                      item.region?.sigunguName,
                      item.areaPyeong ? `${Number(item.areaPyeong)}평` : null,
                      item.categories.map((c) => c.nameKo).join('·') || null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>

                  {/*
                    카드에 신뢰 근거를 싣는다.
                    비로그인 SEO 관문에서 사람을 판단할 근거가 0이면 컨택으로 이어지지 않는다.
                    시안 검수 10번.
                  */}
                  <div
                    style={{
                      marginTop: 'var(--space-3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      fontSize: 13,
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    <span style={{ color: 'var(--color-text-primary)' }}>
                      {item.pro.businessName}
                    </span>
                    {item.pro.isApproved && <Badge tone="success">승인</Badge>}
                    {item.pro.careerYears > 0 && <span>경력 {item.pro.careerYears}년</span>}
                    {item.isCostPublic && <Badge tone="secondary">비용 공개</Badge>}
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Main>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: 'var(--space-10) var(--space-4)' }}>
      {children}
    </main>
  );
}

/** 공종 목록은 정본 하나에서만 온다. 화면이 자기 목록을 들고 있지 않는다. */
function CategoryFilter({ selected }: { selected: string[] }) {
  return (
    <nav
      aria-label="공종 필터"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-6)',
      }}
    >
      <FilterChip href="/gallery" active={selected.length === 0} label="전체" />
      {WORK_CATEGORY_SEEDS.map((category) => {
        const active = selected.includes(category.code);
        const next = active
          ? selected.filter((c) => c !== category.code)
          : [...selected, category.code];
        const href = next.length ? `/gallery?categories=${next.join(',')}` : '/gallery';
        return (
          <FilterChip key={category.code} href={href} active={active} label={category.nameKo} />
        );
      })}
    </nav>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
      /* 필터 상태가 URL에 있으므로 공유·북마크·뒤로가기가 그대로 동작한다. */
      aria-current={active ? 'true' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 36,
        padding: '0 var(--space-4)',
        borderRadius: 'var(--radius-full)',
        border: `1px solid ${active ? 'var(--color-primary-500)' : 'var(--color-border)'}`,
        background: active ? 'var(--color-primary-500)' : 'var(--color-surface)',
        color: active ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
        fontSize: 14,
      }}
    >
      {label}
    </a>
  );
}

function Badge({ tone, children }: { tone: 'success' | 'secondary'; children: React.ReactNode }) {
  const palette =
    tone === 'success'
      ? { bg: 'var(--color-success-bg)', fg: 'var(--color-success)' }
      : { bg: 'var(--color-secondary-100)', fg: 'var(--color-secondary-600)' };
  return (
    <span
      style={{
        background: palette.bg,
        color: palette.fg,
        borderRadius: 'var(--radius-sm)',
        padding: '1px 6px',
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
}

/** 빈 상태는 반드시 다음 행동을 준다. 막다른 길로 보내지 않는다. */
function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: { href: string; label: string };
}) {
  return (
    <div
      style={{
        border: '1px dashed var(--color-border-strong)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-12) var(--space-6)',
        textAlign: 'center',
        background: 'var(--color-bg-subtle)',
      }}
    >
      <strong style={{ fontSize: 18 }}>{title}</strong>
      <p
        style={{ color: 'var(--color-text-secondary)', margin: 'var(--space-2) 0 var(--space-6)' }}
      >
        {body}
      </p>
      <a
        href={action.href}
        role="button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0 var(--space-6)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-primary-500)',
          color: 'var(--color-text-inverse)',
          fontWeight: 600,
        }}
      >
        {action.label}
      </a>
    </div>
  );
}
