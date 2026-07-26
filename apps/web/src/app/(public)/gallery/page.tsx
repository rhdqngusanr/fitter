import type { Metadata } from 'next';

import { WORK_CATEGORY_SEEDS } from '@fitter/shared';

import { GalleryGrid } from '../../../components/GalleryGrid';
import { api, type GalleryResponse } from '../../../lib/api';

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
      <main className="shell" style={{ paddingTop: 'var(--space-8)' }}>
        <GalleryEmpty
          title="목록을 불러오지 못했습니다"
          body="잠시 후 다시 시도해 주세요."
          primary={{ href: '/gallery', label: '다시 시도' }}
        />
      </main>
    );
  }

  const isFiltered = selectedCategories.length > 0 || selectedRegions.length > 0;
  /* 서비스 지역이 한 시도뿐이라 시군구를 평평하게 편다. 갤러리 필터는 2단계가 아니다. */
  const sigungu = regionTree.sido.flatMap((s) => s.sigungu);
  /* 빈 상태 문구에 쓰는 사람 말. `성북구 도배 사진이 아직 없습니다` 처럼 조건을 되읽어준다. */
  const filterWords = [
    ...selectedRegions.map((code) => sigungu.find((s) => s.code === code)?.name),
    ...selectedCategories.map((code) => WORK_CATEGORY_SEEDS.find((c) => c.code === code)?.nameKo),
  ].filter(Boolean);

  return (
    <main
      className="shell"
      style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-12)' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {/*
          제목은 모바일에서 눈에 보이지 않는다. 시안의 모바일 프레임은 필터와 사진으로
          바로 들어간다 — 390px 에서는 사진이 먼저다. 다만 `display:none` 이 아니라
          `.visually-hidden` 이다. 문서에서 h1 이 사라지면 안 된다.
        */}
        <div className="gallery-head hide-on-mobile">
          <h1 className="gallery-h1">
            {data.hasAnyContent ? '실제로 시공된 사진만 모았습니다' : '첫 시공 사례를 기다립니다'}
          </h1>
          <p className="gallery-lead">
            {data.hasAnyContent
              ? '연출 컷이 아니라 시공자가 직접 올린 결과물입니다. 마음에 드는 사진에서 바로 시공자에게 문의하세요.'
              : '시공자로 가입하면 첫 번째로 사례를 보여줄 수 있습니다.'}
          </p>
        </div>

        {/* 필터 바. 콘텐츠가 하나도 없으면 필터가 할 일이 없다. */}
        {data.hasAnyContent && (
          <div className="gallery-filters">
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
                small
              />
            )}
          </div>
        )}

        {/* 몇 건인지·무슨 순서인지. 콘텐츠가 적은 초기에 이 숫자가 특히 의미 있다. */}
        {data.items.length > 0 && (
          <span className="gallery-count">
            {data.totalCount ?? data.items.length}건 · 최근 시공순
          </span>
        )}

        {data.items.length === 0 ? (
          /*
           * 빈 상태를 두 갈래로 나눈다.
           * "필터 때문에 0건"과 "아직 아무것도 없어서 0건"은 완전히 다른 화면이다.
           * 시안 검수 6번이 지적한 지점이고, API가 hasAnyContent 로 알려준다.
           */
          isFiltered && data.hasAnyContent ? (
            <GalleryEmpty
              title={`${filterWords.join(' ')} 사진이 아직 없습니다`}
              body="조건을 넓히면 볼 수 있는 시공이 늘어납니다. 원하는 사진이 없다면 의뢰를 올려 시공자에게 직접 제안받으세요."
              secondary={{ href: '/gallery', label: '조건 모두 해제' }}
              primary={{ href: '/requests/new', label: '의뢰 등록하기' }}
            />
          ) : (
            <GalleryEmpty
              title="아직 등록된 사례가 없습니다"
              body="시공자로 가입하면 첫 번째로 사례를 보여줄 수 있습니다. 지금 올린 사진이 가장 먼저 노출됩니다."
              primary={{ href: '/signup', label: '시공자로 시작하기' }}
            />
          )
        ) : (
          <GalleryGrid
            initialItems={data.items}
            initialCursor={data.nextCursor}
            query={query.toString()}
          />
        )}
      </div>
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
  small = false,
}: {
  label: string;
  items: { code: string; name: string }[];
  selected: string[];
  paramKey: 'categories' | 'regions';
  /** 다른 축의 필터. 이 줄을 눌러도 저쪽 선택이 날아가면 안 된다. */
  other: string;
  /** 지역처럼 두 번째 축인 줄. 시안이 한 단 작게 그린다. */
  small?: boolean;
}) {
  const href = (next: string[]) => {
    const parts = [next.length ? `${paramKey}=${next.join(',')}` : '', other].filter(Boolean);
    return parts.length ? `/gallery?${parts.join('&')}` : '/gallery';
  };

  const cls = small ? 'chip chip--sm' : 'chip';

  return (
    <nav aria-label={`${label} 필터`} className="chip-row">
      <a href={href([])} className={cls} aria-pressed={selected.length === 0}>
        전체
      </a>
      {items.map((item) => {
        const active = selected.includes(item.code);
        const next = active ? selected.filter((c) => c !== item.code) : [...selected, item.code];
        return (
          <a key={item.code} href={href(next)} className={cls} aria-pressed={active}>
            {item.name}
          </a>
        );
      })}
    </nav>
  );
}

/**
 * 빈 상태.
 *
 * 시안은 여기에 버튼을 **둘** 준다 — 조건을 푸는 길과 의뢰를 올리는 길이다.
 * 하나만 주면 "볼 게 없다"로 끝나고, 이 서비스에서 그건 곧 이탈이다.
 */
function GalleryEmpty({
  title,
  body,
  secondary,
  primary,
}: {
  title: string;
  body: string;
  secondary?: { href: string; label: string };
  primary: { href: string; label: string };
}) {
  return (
    <div className="empty gallery-empty">
      <strong className="gallery-empty__title">{title}</strong>
      <span className="gallery-empty__body">{body}</span>
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          marginTop: 6,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {secondary && (
          <a href={secondary.href} className="btn btn--secondary btn--lg">
            {secondary.label}
          </a>
        )}
        <a href={primary.href} className="btn btn--primary btn--lg">
          {primary.label}
        </a>
      </div>
    </div>
  );
}
