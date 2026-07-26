import { WORK_CATEGORY_SEEDS } from '@fitter/shared';

import { HowSection } from '../../components/HowSection';
import { PhotoCard } from '../../components/ui/PhotoCard';
import { PhotoImg } from '../../components/ui/PhotoImg';
import { WelcomeBanner } from '../../components/WelcomeBanner';
import { api, imageUrl, type GalleryItem, type GalleryResponse } from '../../lib/api';

/** 최근 시공이 몇 분씩 안 바뀌면 "죽은 서비스"로 보인다. */
export const revalidate = 0;

/**
 * 히어로 콜라주 3장 + 그리드 8장.
 *
 * 시안의 데스크톱은 히어로에 사진 3장, 아래 그리드에 8장을 쓴다. 같은 사진이 한 화면에
 * 두 번 나오면 버그처럼 보이므로 겹치지 않게 앞 3장과 그 뒤 8장으로 나눈다.
 */
const COLLAGE_COUNT = 3;
const GRID_COUNT = 8;

/**
 * 랜딩 (G-01).
 *
 * **3초 안에 전달할 하나는 "종합업체 없이 사진으로 시공자를 직접 고른다"** 이다.
 * 헤드라인 다음이 곧바로 실제 시공 사진인 이유가 그것이다 — 설명보다 사진이 빠르다.
 *
 * 콜드스타트일 때 화면이 통째로 바뀐다. 사진이 0장인데 "이번 주 올라온 시공"이라고
 * 써놓으면 죽은 서비스로 보이고, 숫자 통계에 0을 박으면 안 하느니만 못하다.
 * 그래서 **숫자 대신 변하지 않는 가치 제안**을 보여주고 모집 모드로 전환한다.
 *
 * 근거: design/G-01 랜딩.dc.html · brain/10-제품/리스크 - 콜드스타트.md
 */
export default async function HomePage() {
  let recent: GalleryResponse = { hasAnyContent: false, items: [], nextCursor: null };
  try {
    recent = await api<GalleryResponse>(`/portfolios?limit=${COLLAGE_COUNT + GRID_COUNT}`, {
      revalidate: 0,
    });
  } catch {
    /* 랜딩은 API가 죽어도 떠야 한다. 사진 없이 서비스 설명만 보여준다. */
  }

  const cold = !recent.hasAnyContent;
  const collage = recent.items.slice(0, COLLAGE_COUNT);
  const grid = recent.items.slice(COLLAGE_COUNT, COLLAGE_COUNT + GRID_COUNT);
  /** 가장 최근 사례. 콜드스타트가 아니어도 응답이 비어 있을 수 있으므로 따로 잡아둔다. */
  const lead = recent.items[0];

  return (
    <main>
      {/* ── 히어로 ─────────────────────────────────────── */}
      <section className="shell">
        <WelcomeBanner />

        <div className="landing-hero">
          <div className="landing-hero__copy">
            <span className="landing-eyebrow">반셀프 인테리어 · 공종 직거래</span>

            <h1 className="landing-h1">
              종합업체 없이,
              <br />
              사진으로 시공자를 직접 고릅니다
            </h1>

            <p className="landing-lead">
              &ldquo;이렇게 해주세요&rdquo; 사진을 올리면 그게 곧 의뢰입니다. 도배·바닥·타일처럼
              공종별로 직접 맡기고{' '}
              <strong style={{ color: 'var(--color-text-primary)' }}>일감비만</strong> 지불하세요.
            </p>

            {/*
              콜드스타트에서는 CTA 순서를 뒤집어 시공자 가입을 앞세운다.
              사진이 없는 상태에서 고객을 데려와도 보여줄 게 없다 — 공급이 먼저다.
            */}
            <div className="landing-cta-row">
              {cold ? (
                <>
                  <a href="/signup" className="btn btn--primary landing-cta">
                    시공자로 등록하기
                  </a>
                  <a href="/requests/new" className="btn btn--secondary landing-cta">
                    의뢰 먼저 올리기
                  </a>
                </>
              ) : (
                <>
                  <a href="/requests/new" className="btn btn--primary landing-cta">
                    사진 올리고 의뢰 등록
                  </a>
                  <a href="/signup" className="btn btn--secondary landing-cta">
                    시공자로 시작하기
                  </a>
                </>
              )}
            </div>

            {/*
              콜드스타트에서는 숫자를 쓰지 않는다. "0건"은 안 쓰느니만 못하고
              "6건"도 초라하다. 대신 콘텐츠 양과 무관하게 항상 참인 것을 말한다.
            */}
            <dl className="landing-proof">
              {(cold
                ? [
                    { value: '중간 마진 0원', label: '일감비만 지불' },
                    { value: '서울 4개 구', label: '성북·강북·노원·도봉' },
                    { value: '무료', label: '등록과 이용' },
                  ]
                : [
                    {
                      value: `${recent.totalCount ?? recent.items.length}건`,
                      label: '등록된 시공 사진',
                    },
                    { value: '중간 마진 0원', label: '일감비만 지불' },
                    { value: '무료', label: '등록과 이용' },
                  ]
              ).map((stat) => (
                <div key={stat.label}>
                  <dt className="landing-proof__value">{stat.value}</dt>
                  <dd className="landing-proof__label">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {cold ? <ColdCollage /> : <Collage items={collage} />}
        </div>
      </section>

      {/* ── 최근 시공 ──────────────────────────────────── */}
      <section className="shell" style={{ paddingBottom: 'var(--space-12)' }}>
        {/*
          시안 데스크톱은 공종 칩을 **이 헤더 줄 안에** 둔다. 히어로 바로 아래 독립 줄로
          빼면 칩이 그리드가 아니라 히어로에 붙은 것처럼 읽혀서 무엇을 거르는 필터인지
          모호해진다. 모바일에서만 칩이 다음 줄로 내려간다 — 390px 에 둘 다 안 들어간다.
        */}
        <div className="landing-section-head">
          <h2 className="landing-h2">{cold ? '곧 채워집니다' : '이번 주 올라온 시공'}</h2>
          {!cold && (
            <a href="/gallery" className="landing-more">
              전체 보기
            </a>
          )}
          <div className="chip-row" role="group" aria-label="공종">
            {/*
              `전체` 가 맨 앞에 온다. 시안의 칩 줄은 항상 이걸로 시작하고, 이게 없으면
              필터를 걸었다가 되돌아올 곳이 화면에 없다.
            */}
            <a href="/gallery" className="chip" aria-pressed={false}>
              전체
            </a>
            {WORK_CATEGORY_SEEDS.map((category) => (
              <a
                key={category.code}
                href={`/gallery?categories=${category.code}`}
                className="chip"
                aria-pressed={false}
              >
                {category.nameKo}
              </a>
            ))}
          </div>
        </div>

        {cold ? (
          /*
           * 사진이 0장일 때가 이 서비스의 기본 상태다(매칭 플랫폼은 양쪽이 다 비어서 시작한다).
           * 빈 그리드를 보여주는 대신 **지금 등록하면 유리하다**는 걸 말한다.
           */
          <div
            className="empty"
            style={{ borderRadius: 'var(--radius-lg)', padding: '44px var(--space-8)' }}
          >
            <span className="empty__icon" aria-hidden="true" />
            <strong className="landing-empty__title">첫 시공자를 모집하고 있습니다</strong>
            <span className="landing-empty__body">
              지금 등록하는 시공자는 서울 전 지역 의뢰에 가장 먼저 노출됩니다. 고객이라면 의뢰를
              먼저 올려두세요 — 시공자가 들어오는 즉시 제안이 갑니다.
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
              <a href="/signup" className="btn btn--primary btn--lg">
                시공자로 등록하기
              </a>
              <a href="/requests/new" className="btn btn--secondary btn--lg">
                의뢰 먼저 올리기
              </a>
            </div>
          </div>
        ) : (
          <ul className="landing-grid">
            {grid.map((item, index) => (
              <li key={item.id}>
                <PhotoCard
                  href={`/gallery/${item.id}`}
                  src={imageUrl(item.coverThumbKey)}
                  alt={item.title}
                  tag={item.categories[0]?.nameKo}
                  count={item.photoCount}
                  title={item.title}
                  meta={metaLine(item)}
                  eager={index < 4}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/*
        ── 이용 방법 (#how) ────────────────────────────────
        헤더·푸터의 `이용 방법` 이 여기로 온다. 별도 화면을 만들지 않기로 했다.
        역할 토글이 있어 클라이언트 컴포넌트다. → components/HowSection.tsx
      */}
      <HowSection />

      {/*
        ── 판단 근거 ────────────────────────────────────
        좌우 여백은 `.shell` 이 정한다. 여기서 padding 을 통째로 인라인으로 쓰면
        모바일 분기(16px)까지 덮어써서 데스크톱 여백이 그대로 남는다.

        **콜드스타트에서도 이 섹션은 사라지지 않는다.** 시안이 그렇게 그렸고 이유가 있다 —
        이 서비스가 무엇을 근거로 사람을 고르게 하는지는 사진이 0장이어도 설명해야 하는
        내용이다. 여기를 숨기면 `이용 방법` 다음이 곧바로 마지막 CTA 라 랜딩이 훅 끝난다.
        대신 카드에 `예시` 뱃지를 달아 실적으로 오해받지 않게 한다.
      */}
      <section style={{ padding: '48px 0' }}>
        <div className="shell landing-trust">
          <div className="landing-trust__copy">
            <h2 className="landing-h2">
              맡겨도 되는 사람인지,
              <br />
              카드 한 장에서 판단합니다
            </h2>
            <p className="landing-trust__lead">
              승인 여부, 경력, 활동 지역, 비용 공개 여부. 판단에 필요한 것만 앞에 둡니다. 연락처는
              양쪽이 수락한 뒤에 열립니다.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 6 }}>
              <span className="badge badge--verified">사업자·자격 확인</span>
              <span className="badge badge--success">비용 공개</span>
              <span className="badge badge--info">수락 후 연락처 공개</span>
            </div>
          </div>

          {lead ? <ProCard lead={lead} items={recent.items} /> : <ExampleProCard />}
        </div>
      </section>

      {/* ── 마지막 CTA ─────────────────────────────────── */}
      <section className="landing-band">
        <div className="shell landing-band__inner">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <strong className="landing-band__title">사진 몇 장이면 의뢰가 완성됩니다</strong>
            <span className="landing-band__sub">
              가입은 30초, 등록은 3분. 비용은 시공자와 직접 정합니다.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/requests/new" className="btn btn--primary landing-cta">
              의뢰 등록하기
            </a>
            <a href="/signup" className="btn btn--secondary landing-cta">
              시공자로 시작
            </a>
          </div>
        </div>
      </section>

      {/*
        모바일 하단 고정 CTA. 시안의 모바일 프레임은 밴드 대신 이걸 갖고 있다.
        데스크톱에서는 `.sticky-cta` 가 숨는다 — 히어로와 밴드에 이미 같은 버튼이 있다.
      */}
      <div className="shell">
        <div className="sticky-cta">
          <a
            href={cold ? '/signup' : '/requests/new'}
            className="btn btn--primary btn--lg btn--block"
          >
            {cold ? '시공자로 등록하기' : '사진 올리고 의뢰 등록'}
          </a>
        </div>
      </div>
    </main>
  );
}

/** 카드 메타 한 줄. 시안은 `성북구 24평 · 김도배` 형식이다. */
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

/**
 * 히어로 콜라주. 큰 사진 하나 + 작은 둘.
 *
 * 큰 사진에만 캡션을 얹는다. 셋 다 얹으면 사진이 아니라 글자가 먼저 읽힌다.
 */
function Collage({ items }: { items: GalleryItem[] }) {
  const lead = items[0];
  if (!lead) return null;
  const rest = items.slice(1);
  const leadSrc = imageUrl(lead.coverThumbKey);

  return (
    <div className="landing-collage" aria-hidden="true">
      <div className="landing-collage__cell landing-collage__cell--big">
        {leadSrc && <PhotoImg src={leadSrc} alt="" eager />}
        <span className="landing-collage__caption">{metaLine(lead)}</span>
      </div>
      {rest.slice(0, 2).map((item) => {
        const src = imageUrl(item.coverThumbKey);
        return (
          <div key={item.id} className="landing-collage__cell">
            {src && <PhotoImg src={src} alt="" eager />}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 콜드스타트의 히어로 오른쪽.
 *
 * 사진 자리를 빈 채로 두지 않고 **모집 중이라는 사실**로 채운다.
 * 시안이 여기에 공종별 대기 현황을 놓은 이유는, 비어 있다는 걸 숨기는 대신
 * "지금 들어오면 첫 번째"라는 유인으로 바꾸기 때문이다.
 */
function ColdCollage() {
  return (
    <div className="landing-cold">
      <span className="landing-cold__label">OPENING SOON · SEOUL</span>
      <strong className="landing-cold__title">
        아직 시공 사진이 없습니다.&nbsp;첫 번째가 되면 모든 의뢰에 가장 먼저 노출됩니다.
      </strong>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {WORK_CATEGORY_SEEDS.slice(0, 3).map((category) => (
          <div key={category.code} className="landing-cold__row">
            <span className="landing-cold__name">{category.nameKo}</span>
            <span className="landing-cold__note">모집 중</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 콜드스타트용 예시 카드.
 *
 * **`예시` 뱃지가 이 컴포넌트의 핵심이다.** 시안이 빈 상태에서도 판단 근거 섹션을 유지하되
 * 이 뱃지를 켜도록 그렸다. 뱃지 없이 그리면 없는 시공자를 있는 것처럼 광고하는 게 되고,
 * 섹션째 숨기면 "무엇을 보고 고르는가"라는 이 서비스의 핵심 설명이 사라진다.
 *
 * 숫자는 넣지 않는다. 시안은 `시공 87건 · 평균 응답 3시간` 을 썼지만 그건 실적처럼 읽히고,
 * API 에 그 집계 자체가 없어서 진짜가 되어도 채울 수 없는 칸이다.
 */
function ExampleProCard() {
  return (
    <div className="landing-procard">
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <span className="avatar avatar--52" aria-hidden="true">
          예시
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              flexWrap: 'wrap',
            }}
          >
            <strong className="landing-procard__name">시공자 카드</strong>
            <span className="badge badge--verified">승인 시공자</span>
            {/* 시안의 `예시` 뱃지가 bg-sunken + text-tertiary 다. muted 가 그 값이다. */}
            <span className="badge badge--muted">예시</span>
          </span>
          <span className="landing-procard__meta">공종 · 경력 연차</span>
          <span className="landing-procard__area">활동 지역</span>
        </span>
      </div>

      <div className="landing-procard__strip" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} data-placeholder="" />
        ))}
      </div>

      <div className="landing-procard__foot">
        <span className="landing-procard__phone">
          연락처 <span style={{ fontFamily: 'var(--font-mono)' }}>010-••••-••••</span> · 수락 후
          공개
        </span>
        <a href="/signup" className="btn btn--primary btn--md">
          시공자로 등록하기
        </a>
      </div>
    </div>
  );
}

/**
 * 시공자 카드 예시.
 *
 * **시안은 이 자리에 `김도배 · 경력 11년 · 시공 87건` 같은 만들어낸 카드를 그렸다.**
 * 그대로 옮기면 랜딩에 없는 실적을 적는 것이 되므로 **실제 데이터로 그린다** —
 * 가장 최근 사례의 시공자, 그 사람의 실제 경력과 활동 지역, 그 사람의 실제 사진들이다.
 *
 * 시공 건수와 평균 응답 시간은 API 에 집계가 없어서 뺐다. 없는 숫자를 지어내는 것보다
 * 있는 것만 보여주는 쪽이 이 섹션의 주장("판단에 필요한 것만 앞에 둔다")에 맞다.
 */
function ProCard({ lead, items }: { lead: GalleryItem; items: GalleryItem[] }) {
  const pro = lead.pro;
  /* 같은 시공자의 사진을 먼저 채우고, 부족하면 다른 사례로 채운다. */
  const mine = items.filter((item) => item.pro.id === pro.id);
  const strip = [...mine, ...items.filter((item) => item.pro.id !== pro.id)].slice(0, 4);

  return (
    <div className="landing-procard">
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <span className="avatar avatar--52" aria-hidden="true">
          {pro.businessName.slice(0, 2)}
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              flexWrap: 'wrap',
            }}
          >
            <strong className="landing-procard__name">{pro.businessName}</strong>
            {pro.isApproved && <span className="badge badge--verified">승인 시공자</span>}
          </span>
          <span className="landing-procard__meta">
            {[lead.categories.map((c) => c.nameKo).join('·'), `경력 ${pro.careerYears}년`]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {lead.region && (
            <span className="landing-procard__area">활동 지역 {lead.region.sigunguName}</span>
          )}
        </span>
      </div>

      <div className="landing-procard__strip" aria-hidden="true">
        {strip.map((item) => {
          const src = imageUrl(item.coverThumbKey);
          return <span key={item.id}>{src && <PhotoImg src={src} alt="" />}</span>;
        })}
      </div>

      <div className="landing-procard__foot">
        {/*
          연락처 자리를 점으로 보여주는 것 자체가 이 서비스의 규칙을 설명한다.
          "수락 후 공개"라고 글로만 쓰면 안 읽힌다.
        */}
        <span className="landing-procard__phone">
          연락처 <span style={{ fontFamily: 'var(--font-mono)' }}>010-••••-••••</span> · 수락 후
          공개
        </span>
        <a href={`/gallery/${lead.id}`} className="btn btn--primary btn--md">
          사례 보기
        </a>
      </div>
    </div>
  );
}
