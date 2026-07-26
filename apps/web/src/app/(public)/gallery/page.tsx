import type { Metadata } from 'next';

import { WORK_CATEGORY_SEEDS } from '@fitter/shared';

import { api, imageUrl, type GalleryResponse } from '../../../lib/api';

export const metadata: Metadata = {
  title: '시공 사례',
  description: '실제 시공자가 올린 작업 사진을 공종과 지역으로 찾아보세요.',
};

/** 목록은 항상 최신이어야 한다. 새 포트폴리오가 몇 분씩 안 보이면 시공자가 이탈한다. */
export const revalidate = 0;

interface RegionTree {
  sido: { code: string; name: string; sigungu: { code: string; name: string }[] }[];
}

interface PageProps {
  searchParams: Promise<{ categories?: string; regions?: string }>;
}

/**
 * 포트폴리오 갤러리 (C-04).
 *
 * **비로그인 공개이고 SSR로 색인된다.** 포트폴리오 사진은 시공자 본인의 작업물이라
 * 공개 권리를 확보할 수 있고, 여기가 콜드스타트를 뚫을 유일한 유입 통로다.
 *
 * 시안의 원칙은 한 줄이다 — **UI 크롬을 최소로 두고 사진이 화면의 대부분을 차지한다.**
 * 카드 아래 한 줄은 "무엇을·누가·어디서"만 담는다. 승인 뱃지를 여기 달지 않는 이유는
 * 갤러리에 뜨는 항목은 이미 전부 승인된 것이기 때문이다 — 모두에게 붙는 뱃지는 정보가 0이다.
 *
 * 근거: design/C-04 C-05 포트폴리오 갤러리·상세.dc.html · brain/30-설계/시안 대조 결과.md
 */
export default async function GalleryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const selectedCategories = params.categories?.split(',').filter(Boolean) ?? [];
  const selectedRegions = params.regions?.split(',').filter(Boolean) ?? [];

  const query = new URLSearchParams();
  if (params.categories) query.set('categories', params.categories);
  if (params.regions) query.set('regions', params.regions);

  let data: GalleryResponse;
  let regionTree: RegionTree = { sido: [] };
  try {
    [data, regionTree] = await Promise.all([
      api<GalleryResponse>(`/portfolios?${query.toString()}`, { revalidate: 0 }),
      api<RegionTree>('/regions', { revalidate: 0 }),
    ]);
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

  const isFiltered = selectedCategories.length > 0 || selectedRegions.length > 0;
  /* 서비스 지역이 한 시도뿐이라 시군구를 평평하게 편다. 갤러리 필터는 2단계가 아니다. */
  const sigungu = regionTree.sido.flatMap((s) => s.sigungu);

  return (
    <>
      {/* 필터는 본문 위에 붙는 별도 띠다. 가로로 흐르게 두어 좁은 화면에서도 한 줄을 지킨다. */}
      {data.hasAnyContent && (
        <div
          style={{
            background: 'var(--color-bg)',
            borderBottom: '1px solid var(--color-border)',
            padding: 'var(--space-3) 0 var(--space-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          <ChipRow
            label="공종"
            items={WORK_CATEGORY_SEEDS.map((c) => ({ code: c.code, name: c.nameKo }))}
            selected={selectedCategories}
            paramKey="categories"
            other={params.regions ? `regions=${params.regions}` : ''}
          />
          {sigungu.length > 0 && (
            <ChipRow
              label="지역"
              items={sigungu}
              selected={selectedRegions}
              paramKey="regions"
              other={params.categories ? `categories=${params.categories}` : ''}
            />
          )}
        </div>
      )}

      <Main>
        <header style={{ marginBottom: 'var(--space-5)' }}>
          {/*
            콘텐츠가 0건이면 히어로 카피까지 모집 모드로 바뀐다.
            시안 검수 7번 — 화면이 자기모순에 빠지지 않게 한다.
          */}
          <h1 style={{ fontSize: 24, margin: 0 }}>
            {data.hasAnyContent ? '시공 사례' : '첫 시공 사례를 기다립니다'}
          </h1>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              margin: 'var(--space-2) 0 0',
              fontSize: 14,
            }}
          >
            {data.hasAnyContent
              ? '마음에 드는 사진을 고르면 그 시공자에게 바로 문의할 수 있습니다.'
              : '시공자로 가입하면 첫 번째로 사례를 보여줄 수 있습니다.'}
          </p>
        </header>

        {/* 몇 건인지·무슨 순서인지. 콘텐츠가 적은 초기에 이 숫자가 특히 의미 있다. */}
        {data.items.length > 0 && (
          <p
            style={{
              margin: '0 0 var(--space-4)',
              fontSize: 13,
              color: 'var(--color-text-tertiary)',
            }}
          >
            {data.totalCount ?? data.items.length}건 · 최근 시공순
          </p>
        )}

        {data.items.length === 0 ? (
          /*
           * 빈 상태를 두 갈래로 나눈다.
           * "필터 때문에 0건"과 "아직 아무것도 없어서 0건"은 완전히 다른 화면이다.
           * 시안 검수 6번이 지적한 지점이고, API가 hasAnyContent 로 알려준다.
           */
          isFiltered && data.hasAnyContent ? (
            <EmptyState
              title="조건에 맞는 사례가 없습니다"
              body="공종이나 지역을 넓혀보면 다른 사례를 볼 수 있습니다."
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
              gap: 'var(--space-3)',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            }}
          >
            {data.items.map((item, index) => (
              <li key={item.id}>
                <a
                  href={`/gallery/${item.id}`}
                  style={{
                    display: 'block',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    background: 'var(--color-bg)',
                    color: 'inherit',
                  }}
                >
                  <span
                    style={{
                      position: 'relative',
                      display: 'block',
                      aspectRatio: '4 / 3',
                      background: 'var(--color-bg-sunken)',
                    }}
                  >
                    {imageUrl(item.coverThumbKey) && (
                      /*
                       * next/image 를 쓰지 않는다. 이미 400px 썸네일로 파생해 둔 이미지라
                       * 최적화 서버를 한 번 더 태울 이유가 없다. 원본은 목록에 오지 않는다.
                       *
                       * 첫 줄 카드만 즉시 불러온다. 화면에 처음 보이는 사진이 늦으면
                       * 그게 곧 체감 로딩 시간이 된다.
                       */
                      <img
                        src={imageUrl(item.coverThumbKey) ?? ''}
                        alt={item.title}
                        loading={index < 4 ? 'eager' : 'lazy'}
                        fetchPriority={index < 4 ? 'high' : undefined}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    )}

                    {/*
                      사진 위에는 컬러를 얹지 않는다 — 사진의 색이 죽는다.
                      불투명 흰 칩과 scrim 만 허용한다. 디자인 시스템의 "사진 위 오버레이 규칙".
                    */}
                    {item.categories[0] && (
                      <span
                        style={{
                          position: 'absolute',
                          left: 'var(--space-2)',
                          top: 'var(--space-2)',
                          background: 'rgba(255,255,255,.94)',
                          color: 'var(--color-text-primary)',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        {item.categories[0].nameKo}
                      </span>
                    )}
                    {item.photoCount > 1 && (
                      <span
                        style={{
                          position: 'absolute',
                          right: 'var(--space-2)',
                          bottom: 'var(--space-2)',
                          background: 'var(--color-scrim)',
                          color: 'var(--color-text-inverse)',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        {item.photoCount}장
                      </span>
                    )}
                  </span>

                  <span
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-1)',
                      padding: '10px 12px 12px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        lineHeight: 1.4,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {item.title}
                    </span>
                    {/*
                      한 줄에 "어디서·얼마나·누가"를 담는다. 시공자 이름이 여기 들어가는 게
                      핵심이다 — 비로그인 관문에서 사람을 판단할 근거가 이것뿐이다(시안 검수 10번).
                    */}
                    <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                      {[
                        item.region?.sigunguName,
                        item.areaPyeong ? `${Number(item.areaPyeong)}평` : null,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      {' · '}
                      {item.pro.businessName}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Main>
    </>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        maxWidth: 1120,
        margin: '0 auto',
        padding: 'var(--space-6) var(--space-4) var(--space-12)',
      }}
    >
      {children}
    </main>
  );
}

/**
 * 필터 칩 한 줄.
 *
 * 가로 스크롤로 흐르게 둔다. 줄바꿈시키면 좁은 화면에서 필터가 화면 절반을 먹는다.
 * 선택 상태는 URL에 산다 — 공유·북마크·뒤로가기가 그냥 동작한다.
 */
function ChipRow({
  label,
  items,
  selected,
  paramKey,
  other,
}: {
  label: string;
  items: { code: string; name: string }[];
  selected: string[];
  paramKey: 'categories' | 'regions';
  /** 다른 축의 필터. 이 줄을 눌러도 저쪽 선택이 날아가면 안 된다. */
  other: string;
}) {
  const href = (next: string[]) => {
    const parts = [next.length ? `${paramKey}=${next.join(',')}` : '', other].filter(Boolean);
    return parts.length ? `/gallery?${parts.join('&')}` : '/gallery';
  };

  return (
    <nav
      aria-label={`${label} 필터`}
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        overflowX: 'auto',
        padding: '0 var(--space-4)',
        scrollbarWidth: 'none',
      }}
    >
      <Chip href={href([])} active={selected.length === 0} label="전체" />
      {items.map((item) => {
        const active = selected.includes(item.code);
        const next = active ? selected.filter((c) => c !== item.code) : [...selected, item.code];
        return <Chip key={item.code} href={href(next)} active={active} label={item.name} />;
      })}
    </nav>
  );
}

function Chip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
      aria-current={active ? 'true' : undefined}
      style={{
        flex: '0 0 auto',
        display: 'inline-flex',
        alignItems: 'center',
        height: 36,
        padding: '0 15px',
        borderRadius: 'var(--radius-full)',
        border: `1px solid ${active ? 'var(--color-primary-500)' : 'var(--color-border-strong)'}`,
        background: active ? 'var(--color-primary-500)' : 'var(--color-surface)',
        color: active ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
        fontSize: 14,
        fontWeight: 600,
        textDecoration: 'none',
      }}
    >
      {label}
    </a>
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
          textDecoration: 'none',
        }}
      >
        {action.label}
      </a>
    </div>
  );
}
