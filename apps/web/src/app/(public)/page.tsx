import { WORK_CATEGORY_SEEDS } from '@fitter/shared';

import { api, imageUrl, type GalleryResponse } from '../../lib/api';

/** 최근 시공이 몇 분씩 안 바뀌면 "죽은 서비스"로 보인다. */
export const revalidate = 0;

/** 랜딩에 거는 최근 시공. 시안과 같은 6장이다. */
const RECENT_LIMIT = 6;

/**
 * 랜딩 (G-01).
 *
 * **3초 안에 전달할 하나는 "종합업체 없이 사진으로 시공자를 직접 고른다"** 이다.
 * 헤드라인 다음이 곧바로 실제 시공 사진 그리드인 이유가 그것이다 — 설명보다 사진이 빠르다.
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
    recent = await api<GalleryResponse>(`/portfolios?limit=${RECENT_LIMIT}`, { revalidate: 0 });
  } catch {
    /* 랜딩은 API가 죽어도 떠야 한다. 사진 없이 서비스 설명만 보여준다. */
  }

  const cold = !recent.hasAnyContent;

  return (
    <main>
      {/* ── 히어로 ─────────────────────────────────────── */}
      <section
        style={{
          background: 'var(--color-primary-50)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div
          style={{ maxWidth: 1120, margin: '0 auto', padding: 'var(--space-16) var(--space-4)' }}
        >
          <span
            style={{
              display: 'inline-block',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-primary-600)',
              marginBottom: 'var(--space-4)',
            }}
          >
            반셀프 인테리어 · 공종 직거래
          </span>

          <h1 style={{ fontSize: 36, lineHeight: 1.3, margin: 0, maxWidth: 640, fontWeight: 800 }}>
            종합업체 없이,
            <br />
            사진으로 시공자를 직접 고릅니다
          </h1>

          <p
            style={{
              fontSize: 17,
              lineHeight: 1.7,
              color: 'var(--color-text-secondary)',
              maxWidth: 560,
              margin: 'var(--space-4) 0 var(--space-8)',
            }}
          >
            &ldquo;이렇게 해주세요&rdquo; 사진을 올리면 그게 곧 의뢰입니다. 도배·바닥·타일처럼
            공종별로 직접 맡기고 일감비만 지불하세요.
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-10)',
            }}
          >
            <Cta href="/requests/new" variant="primary">
              사진 올리고 의뢰 등록
            </Cta>
            <Cta href="/signup" variant="secondary">
              시공자로 시작하기
            </Cta>
          </div>

          {/*
            콜드스타트에서는 숫자를 쓰지 않는다. "0건"은 안 쓰느니만 못하고
            "6건"도 초라하다. 대신 콘텐츠 양과 무관하게 항상 참인 것을 말한다.
          */}
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 'var(--space-5)',
              margin: 0,
              maxWidth: 640,
            }}
          >
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
                <dt style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {stat.value}
                </dt>
                <dd
                  style={{
                    margin: 'var(--space-1) 0 0',
                    fontSize: 13,
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── 공종 칩 ────────────────────────────────────── */}
      <nav
        aria-label="공종"
        style={{
          background: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          gap: 'var(--space-2)',
          overflowX: 'auto',
          padding: 'var(--space-3) var(--space-4)',
          scrollbarWidth: 'none',
        }}
      >
        {WORK_CATEGORY_SEEDS.map((category) => (
          <a
            key={category.code}
            href={`/gallery?categories=${category.code}`}
            style={{
              flex: '0 0 auto',
              display: 'inline-flex',
              alignItems: 'center',
              height: 36,
              padding: '0 15px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border-strong)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {category.nameKo}
          </a>
        ))}
      </nav>

      {/* ── 최근 시공 ──────────────────────────────────── */}
      <section
        style={{ maxWidth: 1120, margin: '0 auto', padding: 'var(--space-10) var(--space-4)' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 'var(--space-5)',
          }}
        >
          <h2 style={{ fontSize: 20, margin: 0 }}>{cold ? '곧 채워집니다' : '최근 올라온 시공'}</h2>
          {!cold && (
            <a href="/gallery" style={{ fontSize: 14, fontWeight: 600 }}>
              전체 보기
            </a>
          )}
        </div>

        {cold ? (
          /*
           * 사진이 0장일 때가 이 서비스의 기본 상태다(매칭 플랫폼은 양쪽이 다 비어서 시작한다).
           * 빈 그리드를 보여주는 대신 **지금 등록하면 유리하다**는 걸 말한다.
           */
          <div
            style={{
              border: '1px dashed var(--color-border-strong)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-bg-subtle)',
              padding: 'var(--space-10) var(--space-6)',
              textAlign: 'center',
            }}
          >
            <strong style={{ fontSize: 18 }}>첫 시공자를 모집하고 있습니다</strong>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                maxWidth: 520,
                margin: 'var(--space-3) auto var(--space-6)',
                lineHeight: 1.7,
              }}
            >
              지금 등록하는 시공자는 서울 전 지역 의뢰에 가장 먼저 노출됩니다. 고객이라면 의뢰를
              먼저 올려두세요 — 시공자가 들어오는 즉시 제안이 갑니다.
            </p>
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Cta href="/signup" variant="primary">
                시공자로 등록하기
              </Cta>
              <Cta href="/requests/new" variant="secondary">
                의뢰 먼저 올리기
              </Cta>
            </div>
          </div>
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
            {recent.items.map((item, index) => (
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
                    textDecoration: 'none',
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
                      <img
                        src={imageUrl(item.coverThumbKey) ?? ''}
                        alt={item.title}
                        loading={index < 3 ? 'eager' : 'lazy'}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    )}
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
                  </span>
                  <span
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-1)',
                      padding: '10px 12px 12px',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>
                      {item.title}
                    </span>
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
      </section>

      {/* ── 3단계 ──────────────────────────────────────── */}
      <section
        style={{
          background: 'var(--color-bg)',
          borderTop: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div
          style={{ maxWidth: 1120, margin: '0 auto', padding: 'var(--space-12) var(--space-4)' }}
        >
          <h2 style={{ fontSize: 20, margin: '0 0 var(--space-6)' }}>3단계로 끝납니다</h2>
          <ol
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: 'var(--space-6)',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            }}
          >
            {[
              {
                title: '사진을 올린다',
                body: '마음에 든 사진 3~10장이면 충분합니다. 인테리어 용어는 몰라도 됩니다.',
              },
              {
                title: '제안을 받는다',
                body: '조건에 맞는 공종 시공자가 자기 포트폴리오와 함께 제안을 보냅니다.',
              },
              {
                title: '직접 고른다',
                body: '수락하면 연락처가 열립니다. 비용은 시공자와 직접 정하고, 중간 마진은 없습니다.',
              },
            ].map((step, i) => (
              <li key={step.title}>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-primary-500)',
                    color: 'var(--color-text-inverse)',
                    fontWeight: 800,
                    marginBottom: 'var(--space-3)',
                  }}
                >
                  {i + 1}
                </span>
                <strong style={{ display: 'block', fontSize: 16, marginBottom: 'var(--space-2)' }}>
                  {step.title}
                </strong>
                <span
                  style={{
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {step.body}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}

function Cta({
  href,
  variant,
  children,
}: {
  href: string;
  variant: 'primary' | 'secondary';
  children: React.ReactNode;
}) {
  const primary = variant === 'primary';
  return (
    <a
      href={href}
      role="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 var(--space-8)',
        borderRadius: 'var(--radius-md)',
        fontWeight: 700,
        fontSize: 15,
        textDecoration: 'none',
        background: primary ? 'var(--color-primary-500)' : 'var(--color-surface)',
        color: primary ? 'var(--color-text-inverse)' : 'var(--color-primary-600)',
        border: `1px solid ${primary ? 'var(--color-primary-500)' : 'var(--color-border-strong)'}`,
      }}
    >
      {children}
    </a>
  );
}
