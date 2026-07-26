import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { HOUSING_TYPE_LABELS, MATERIAL_GRADE_LABELS } from '@fitter/shared';

import { api, imageUrl, ApiError, type PortfolioDetail } from '../../../../lib/api';

interface PageProps {
  params: Promise<{ id: string }>;
}

/** 조회수가 오르므로 캐시하지 않는다. */
export const revalidate = 0;

async function load(id: string): Promise<PortfolioDetail> {
  try {
    return await api<PortfolioDetail>(`/portfolios/${id}`, { revalidate: 0 });
  } catch (error) {
    /*
     * 없는 항목·비공개 항목·미승인 시공자의 항목이 전부 404로 온다.
     * 셋을 구분해 알려주면 "존재는 한다"가 새므로 화면도 구분하지 않는다.
     */
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const item = await load(id);
  const where = [item.region?.sigunguName, item.areaPyeong ? `${Number(item.areaPyeong)}평` : null]
    .filter(Boolean)
    .join(' ');
  return {
    title: item.title,
    /* 색인되는 공개 화면이다. 검색 결과에 보일 문장을 실제 내용으로 채운다. */
    description: item.description ?? `${where} ${item.categories.map((c) => c.nameKo).join('·')}`,
  };
}

/**
 * 포트폴리오 상세 (C-05).
 *
 * **컨택 직전 화면이다.** 여기서 신뢰 판단이 끝나야 문의 버튼이 눌린다.
 * 그래서 사진 다음으로 중요한 게 "누가 했는가"이고, 시공 조건(평수·자재·기간)이
 * 그 다음이다. 금액은 공개한 시공자만 보여준다 — 강제할 수 없으니 유인으로 접근한다.
 *
 * 근거: brain/30-설계/화면 목록.md · brain/50-결정/ADR-011 - 신뢰 장치 설계.md
 */
export default async function PortfolioDetailPage({ params }: PageProps) {
  const { id } = await params;
  const item = await load(id);

  /* before가 있어야 대비가 성립한다. 없으면 그냥 나열한다. */
  const before = item.images.find((i) => i.phase === 'BEFORE');
  const after = item.images.find((i) => i.phase === 'AFTER');
  const hasContrast = !!before && !!after;
  const rest = hasContrast
    ? item.images.filter((i) => i !== before && i !== after)
    : item.images.slice(1);
  const lead = hasContrast ? null : item.images[0];

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: 'var(--space-8) var(--space-4)' }}>
      <nav style={{ marginBottom: 'var(--space-6)', fontSize: 14 }}>
        <a href="/gallery" style={{ color: 'var(--color-text-secondary)' }}>
          ← 시공 사례
        </a>
      </nav>

      <h1 style={{ fontSize: 28, margin: '0 0 var(--space-2)' }}>{item.title}</h1>
      <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 var(--space-8)' }}>
        {[
          item.region?.sigunguName,
          item.housingType ? HOUSING_TYPE_LABELS[item.housingType] : null,
          item.categories.map((c) => c.nameKo).join('·') || null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {hasContrast ? (
        <div
          style={{
            display: 'grid',
            gap: 'var(--space-3)',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            marginBottom: 'var(--space-6)',
          }}
        >
          <Photo image={before} caption="시공 전" alt={`${item.title} 시공 전`} />
          <Photo image={after} caption="시공 후" alt={`${item.title} 시공 후`} />
        </div>
      ) : (
        lead && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <Photo image={lead} alt={item.title} />
          </div>
        )
      )}

      {rest.length > 0 && (
        <div
          style={{
            display: 'grid',
            gap: 'var(--space-3)',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            marginBottom: 'var(--space-8)',
          }}
        >
          {rest.map((image) => (
            <Photo key={image.id} image={image} alt={item.title} />
          ))}
        </div>
      )}

      {item.description && (
        <p style={{ whiteSpace: 'pre-wrap', margin: '0 0 var(--space-8)' }}>{item.description}</p>
      )}

      <section
        aria-label="시공 조건"
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <dl
          style={{
            display: 'grid',
            gap: 'var(--space-4)',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            margin: 0,
          }}
        >
          {/*
            평수는 평과 ㎡를 함께 보여준다. ㎡는 서버가 평에서 파생한 값이라
            화면이 다시 계산하지 않는다 — 파생 경로가 둘이면 언젠가 갈라진다.
          */}
          {item.areaPyeong && (
            <Fact
              label="면적"
              value={`${Number(item.areaPyeong)}평`}
              sub={item.areaM2 ? `${item.areaM2.toFixed(1)}㎡` : undefined}
            />
          )}
          {item.materialGrade && (
            <Fact label="자재 등급" value={MATERIAL_GRADE_LABELS[item.materialGrade] ?? '—'} />
          )}
          {item.workDays && <Fact label="공사 기간" value={`${item.workDays}일`} />}
          {item.workedAt && (
            <Fact label="시공 시기" value={item.workedAt.slice(0, 7).replace('-', '년 ') + '월'} />
          )}
          {/*
            금액은 공개한 시공자만 보여준다. 비공개면 키 자체가 응답에 없으므로
            "비공개"라는 문구조차 띄우지 않는다 — 안 밝힌 걸 강조할 이유가 없다.
          */}
          {item.actualCost !== undefined && (
            <Fact label="실제 비용" value={`${item.actualCost.toLocaleString('ko-KR')}원`} />
          )}
        </dl>
      </section>

      <section
        aria-label="시공자"
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          background: 'var(--color-bg-subtle)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
          }}
        >
          <strong style={{ fontSize: 18 }}>{item.pro.businessName}</strong>
          {item.pro.isApproved && (
            <span
              style={{
                background: 'var(--color-success-bg)',
                color: 'var(--color-success)',
                borderRadius: 'var(--radius-sm)',
                padding: '1px 6px',
                fontSize: 12,
              }}
            >
              승인
            </span>
          )}
          {item.pro.careerYears > 0 && (
            <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>
              경력 {item.pro.careerYears}년
            </span>
          )}
        </div>

        {item.pro.intro && (
          <p style={{ margin: '0 0 var(--space-3)', color: 'var(--color-text-secondary)' }}>
            {item.pro.intro}
          </p>
        )}

        {item.pro.serviceAreas.length > 0 && (
          <p
            style={{
              margin: '0 0 var(--space-5)',
              fontSize: 14,
              color: 'var(--color-text-tertiary)',
            }}
          >
            활동 지역 {item.pro.serviceAreas.map((a) => a.sigunguName).join(' · ')}
          </p>
        )}

        {/*
          문의 화면으로 바로 보낸다. 비로그인이면 거기서 로그인으로 튕기고,
          로그인 뒤 다시 여기로 돌아온다 — 로그인 여부를 SSR이 알 수 없으므로
          판단을 클라이언트 쪽 화면 하나에 몰아둔다.

          연락처는 컨택이 ACCEPTED가 되기 전에는 어떤 경로로도 나오지 않는다.
          이 버튼은 컨택을 "요청"할 뿐이고 수락 여부는 시공자가 정한다.
        */}
        <a
          href={`/contacts/new?portfolioItemId=${item.id}`}
          role="button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 var(--space-8)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-primary-500)',
            color: 'var(--color-text-inverse)',
            fontWeight: 600,
          }}
        >
          이 시공자에게 문의
        </a>
      </section>
    </main>
  );
}

/**
 * 상세 사진.
 *
 * 1200px 파생을 쓴다. 원본은 어떤 화면에도 오지 않는다 —
 * 무단 재사용을 조금이라도 어렵게 만드는 게 저작권 리스크 대응의 일부다.
 */
function Photo({
  image,
  caption,
  alt,
}: {
  image: { thumb1200Key: string | null; thumb400Key: string | null };
  caption?: string;
  alt: string;
}) {
  const src = imageUrl(image.thumb1200Key ?? image.thumb400Key);
  if (!src) return null;
  return (
    <figure style={{ margin: 0, position: 'relative' }}>
      <img
        src={src}
        alt={caption ? `${alt} ${caption}` : alt}
        loading="lazy"
        style={{
          width: '100%',
          display: 'block',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-sunken)',
        }}
      />
      {caption && (
        <figcaption
          style={{
            position: 'absolute',
            left: 'var(--space-3)',
            top: 'var(--space-3)',
            background: 'var(--color-scrim)',
            color: 'var(--color-text-inverse)',
            borderRadius: 'var(--radius-full)',
            padding: '2px 12px',
            fontSize: 13,
          }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>{label}</dt>
      <dd style={{ margin: 'var(--space-1) 0 0', fontWeight: 600 }}>
        {value}
        {sub && (
          <span
            style={{
              fontWeight: 400,
              color: 'var(--color-text-tertiary)',
              marginLeft: 'var(--space-2)',
            }}
          >
            {sub}
          </span>
        )}
      </dd>
    </div>
  );
}
