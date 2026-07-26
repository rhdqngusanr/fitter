import type { Metadata } from 'next';

import { WORK_CATEGORY_SEEDS } from '@fitter/shared';

import { Avatar } from '../../../components/ui/Avatar';
import { api, imageUrl } from '../../../lib/api';

export const metadata: Metadata = {
  title: '시공자 찾기',
  description: '승인된 반셀프 인테리어 시공자를 공종과 지역으로 찾아보세요.',
};

/** 목록은 항상 최신이어야 한다. 새로 승인된 시공자가 몇 분씩 안 보이면 안 된다. */
export const revalidate = 0;

interface ProRow {
  id: string;
  businessName: string;
  intro: string | null;
  careerYears: number;
  categories: { code: string; nameKo: string }[];
  serviceAreas: { code: string; sigunguName: string }[];
  portfolioCount: number;
  recentCovers: string[];
  hasCostPublic: boolean;
}

interface ProsResponse {
  hasAnyContent: boolean;
  items: ProRow[];
  nextCursor: string | null;
}

interface RegionTree {
  sido: { code: string; name: string; sigungu: { code: string; name: string }[] }[];
}

interface PageProps {
  searchParams: Promise<{ categories?: string; regions?: string; costPublic?: string }>;
}

/**
 * 시공자 목록 (C-06).
 *
 * **비로그인 공개다.** 갤러리 카드가 이미 시공자 이름을 보여주고 있고, 여기는 그 이름을
 * 눌렀을 때 가는 곳이다. 포트폴리오가 공개인데 만든 사람이 비공개면 앞뒤가 안 맞는다.
 *
 * 갤러리(C-04)와 **같은 축**으로 거른다 — 공종·지역. 같은 것을 다른 이름으로 부르지 않는다.
 *
 * 근거: design/C-06 C-07 시공자 목록·상세.dc.html
 */
export default async function ProsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const selectedCategories = params.categories?.split(',').filter(Boolean) ?? [];
  const selectedRegions = params.regions?.split(',').filter(Boolean) ?? [];
  const costOnly = params.costPublic === 'true';

  const query = new URLSearchParams();
  if (params.categories) query.set('categories', params.categories);
  if (params.regions) query.set('regions', params.regions);
  if (costOnly) query.set('costPublic', 'true');

  let data: ProsResponse = { hasAnyContent: false, items: [], nextCursor: null };
  let regionTree: RegionTree = { sido: [] };
  try {
    [data, regionTree] = await Promise.all([
      api<ProsResponse>(`/pros?${query.toString()}`, { revalidate: 0 }),
      api<RegionTree>('/regions', { revalidate: 0 }),
    ]);
  } catch {
    /* 목록을 못 불러와도 화면은 떠야 한다. 아래 빈 상태가 그 자리를 채운다. */
  }

  const sigungu = regionTree.sido.flatMap((s) => s.sigungu);
  const filtered = selectedCategories.length > 0 || selectedRegions.length > 0 || costOnly;

  const href = (next: { categories?: string[]; regions?: string[]; cost?: boolean }) => {
    const parts = [
      (next.categories ?? selectedCategories).length
        ? `categories=${(next.categories ?? selectedCategories).join(',')}`
        : '',
      (next.regions ?? selectedRegions).length
        ? `regions=${(next.regions ?? selectedRegions).join(',')}`
        : '',
      (next.cost ?? costOnly) ? 'costPublic=true' : '',
    ].filter(Boolean);
    return parts.length ? `/pros?${parts.join('&')}` : '/pros';
  };
  const toggle = (list: string[], code: string) =>
    list.includes(code) ? list.filter((c) => c !== code) : [...list, code];

  const emptyBlock = (
    <div className="empty gallery-empty">
      <span className="empty__icon" aria-hidden="true" />
      <strong className="gallery-empty__title">
        {filtered && data.hasAnyContent
          ? '조건에 맞는 시공자가 없습니다'
          : '아직 승인된 시공자가 없습니다'}
      </strong>
      <span className="gallery-empty__body">
        {filtered && data.hasAnyContent
          ? '조건을 넓히면 볼 수 있는 시공자가 늘어납니다. 의뢰를 올려두면 조건에 맞는 시공자가 먼저 제안합니다.'
          : '지금 등록하는 시공자는 모든 의뢰에 가장 먼저 노출됩니다.'}
      </span>
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          marginTop: 6,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {filtered && (
          <a href="/pros" className="btn btn--secondary btn--lg">
            조건 모두 해제
          </a>
        )}
        <a href="/requests/new" className="btn btn--primary btn--lg">
          의뢰 등록하기
        </a>
      </div>
    </div>
  );

  /*
   * 시공자가 한 명도 없으면 사이드바를 그리지 않는다. 거를 것이 없는데 필터만 세 묶음
   * 서 있으면 화면이 고장난 것처럼 보인다. 이때는 빈 상태 하나가 화면 전체다.
   */
  if (!data.hasAnyContent) {
    return (
      <main
        className="shell"
        style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-12)' }}
      >
        <div className="gallery-head" style={{ marginBottom: 'var(--space-5)' }}>
          <h1 className="gallery-h1">맡길 사람을 먼저 고르셔도 됩니다</h1>
          <p className="gallery-lead">
            사업자와 경력이 확인된 시공자만 보입니다. 사진이 아니라 사람으로 찾고 싶을 때 쓰세요.
          </p>
        </div>
        {emptyBlock}
      </main>
    );
  }

  return (
    <main className="pros">
      {/*
        좌측 필터. 시안(C-06)의 272px 사이드바다 — 공종은 알약, 지역·조건은 목록 줄.
        조건을 걸어놓고 결과를 보는 화면이라 무엇을 걸었는지가 계속 보여야 한다.
      */}
      <aside aria-label="필터" className="pros__aside">
        <div className="pros__group">
          <span className="pros__group-label">공종</span>
          <div className="pros__chips">
            <a
              href={href({ categories: [] })}
              className="chip chip--sm"
              aria-pressed={!selectedCategories.length}
            >
              전체
            </a>
            {WORK_CATEGORY_SEEDS.map((c) => (
              <a
                key={c.code}
                href={href({ categories: toggle(selectedCategories, c.code) })}
                className="chip chip--sm"
                aria-pressed={selectedCategories.includes(c.code)}
              >
                {c.nameKo}
              </a>
            ))}
          </div>
        </div>

        <div className="pros__group">
          <span className="pros__group-label">지역</span>
          <div className="pros__checks">
            <a
              href={href({ regions: [] })}
              className="pros__check"
              aria-pressed={!selectedRegions.length}
            >
              <span className="pros__box" aria-hidden="true" />
              전체
            </a>
            {sigungu.map((g) => (
              <a
                key={g.code}
                href={href({ regions: toggle(selectedRegions, g.code) })}
                className="pros__check"
                aria-pressed={selectedRegions.includes(g.code)}
              >
                <span className="pros__box" aria-hidden="true" />
                {g.name}
              </a>
            ))}
          </div>
        </div>

        <div className="pros__group">
          <span className="pros__group-label">조건</span>
          <div className="pros__checks">
            {/* 비용을 공개한 사례가 있는 시공자만. 시안의 조건 토글이다. */}
            <a href={href({ cost: !costOnly })} className="pros__check" aria-pressed={costOnly}>
              <span className="pros__box" aria-hidden="true" />
              비용 공개
            </a>
          </div>
        </div>

        <a href="/pros" className="btn btn--secondary btn--md pros__reset">
          필터 초기화
        </a>
      </aside>

      <div className="pros__main">
        <div className="pros__head">
          <div className="pros__title">
            {/*
              시안의 제목은 `2명 · 추천순` 처럼 결과 수다. 정렬 칩은 붙이지 않았다 —
              시안의 세 정렬(추천순·시공 많은 순·응답 빠른 순)은 우리가 세어본 적 없는
              값이고, 누르면 아무 일도 안 일어나는 칩을 그리는 것이 더 나쁘다.
            */}
            <h1 className="pros__h1">시공자 {data.items.length}명</h1>
            <p className="pros__lead">사업자와 경력이 확인된 시공자만 보입니다.</p>
          </div>
        </div>

        {data.items.length === 0 ? (
          emptyBlock
        ) : (
          <ul className="pros__list">
            {data.items.map((pro) => (
              <li key={pro.id}>
                <ProCard pro={pro} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

/**
 * 시공자 카드 (C-06).
 *
 * **시안의 카드는 위아래 두 덩어리다.** 위는 사람 줄(아바타 56 · 이름+뱃지 · 조건 두 줄 ·
 * `프로필 보기`), 아래는 사진 석 장이 카드 폭을 3등분한 그리드다.
 * 구현은 사진 넉 장을 사람 정보 안쪽에 넣어서 손톱만 하게 깔렸었다 —
 * 이 카드의 목적이 "말 대신 증거"인데 증거가 제일 작았다.
 */
function ProCard({ pro }: { pro: ProRow }) {
  /* 시안은 석 장을 보여주고 마지막 칸에 남은 장수를 얹는다. */
  const shots = pro.recentCovers.slice(0, 3);
  const rest = pro.portfolioCount - 2;

  return (
    <a href={`/pros/${pro.id}`} className="pro-card">
      <span className="pro-card__top">
        <Avatar name={pro.businessName} size={56} />
        <span className="pro-card__body">
          <span className="pro-card__head">
            <span className="pro-card__name">{pro.businessName}</span>
            {/*
              **승인 뱃지를 여기서는 단다.** 갤러리 카드에서는 뺐는데(전부 승인된 항목이라
              정보량이 0이다) 이 목록은 사람을 고르는 화면이라 승인이 첫 번째 판단 근거다.
            */}
            <span className="badge badge--verified">승인 시공자</span>
            {pro.hasCostPublic && <span className="badge badge--success">비용 공개</span>}
          </span>

          <span className="pro-card__meta">
            {[
              pro.categories.map((c) => c.nameKo).join('·') || null,
              pro.careerYears > 0 ? `경력 ${pro.careerYears}년` : null,
              /*
                **`시공 87건` 이 아니라 `사례 2건` 이다.** 우리가 아는 건 올라온 사례 수뿐이고,
                시공 건수는 세어본 적이 없다. 없는 숫자를 지어내면 이 카드 전체를 못 믿게 된다.
              */
              `등록한 사례 ${pro.portfolioCount}건`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>

          {pro.serviceAreas.length > 0 && (
            <span className="pro-card__area">
              활동 지역 {pro.serviceAreas.map((a) => a.sigunguName).join(' · ')}
            </span>
          )}
        </span>

        <span className="pro-card__go">프로필 보기</span>
      </span>

      {shots.length > 0 ? (
        <span
          className={`pro-card__strip${shots.length < 3 ? ` pro-card__strip--${shots.length}` : ''}`}
          aria-hidden="true"
        >
          {shots.map((key, index) => (
            <span key={key} className="pro-card__shot">
              <img src={imageUrl(key) ?? ''} alt="" loading="lazy" />
              {/* 마지막 칸에만 남은 장수를 얹는다. 두 장은 보이고 나머지는 세어서 알린다. */}
              {index === 2 && rest > 1 && <span className="pro-card__more">+{rest}</span>}
            </span>
          ))}
        </span>
      ) : (
        /* 시안이 따로 그려둔 상태다. 사례가 없다고 감추지 않고 무엇을 할 수 있는지 말한다. */
        <span className="pro-card__fresh">
          <span className="pro-card__fresh-title">아직 올린 사진이 없습니다</span>
          <span className="pro-card__fresh-body">
            새로 등록한 시공자입니다. 사업자와 경력은 확인되었지만 시공 사진은 아직 없습니다.
            문의하면서 사진을 요청할 수 있습니다.
          </span>
        </span>
      )}
    </a>
  );
}
