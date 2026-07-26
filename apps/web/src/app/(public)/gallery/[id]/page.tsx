import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { HOUSING_TYPE_LABELS, MATERIAL_GRADE_LABELS } from '@fitter/shared';

import {
  api,
  imageUrl,
  ApiError,
  type PortfolioDetail,
  type PortfolioImage,
} from '../../../../lib/api';

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
          <Photo image={before} priority caption="시공 전" alt={`${item.title} 시공 전`} />
          <Photo image={after} priority caption="시공 후" alt={`${item.title} 시공 후`} />
        </div>
      ) : (
        lead && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <Photo image={lead} priority alt={item.title} />
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

      {/*
        시공 조건. 시안은 라벨 하나에 값 하나짜리 칸을 2열로 깐다.
        표가 아니라 칸들인 이유는 값의 성격이 제각각이라 세로 정렬이 의미가 없어서다.
      */}
      <section
        aria-label="시공 조건"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {item.categories.length > 0 && (
          <Fact label="공종" value={item.categories.map((c) => c.nameKo).join('·')} />
        )}
        {/*
          평수와 주거형태를 한 칸에 묶는다 — 둘 다 "얼마나 큰 집인가"를 말한다.
          ㎡는 서버가 평에서 파생한 값이라 화면이 다시 계산하지 않는다.
        */}
        {item.areaPyeong && (
          <Fact
            label="규모"
            value={[
              `${Number(item.areaPyeong)}평`,
              item.housingType ? HOUSING_TYPE_LABELS[item.housingType] : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            sub={item.areaM2 ? `${item.areaM2.toFixed(1)}㎡` : undefined}
          />
        )}
        {item.workDays && <Fact label="기간" value={`${item.workDays}일`} />}
        {item.materialGrade && (
          <Fact label="자재" value={MATERIAL_GRADE_LABELS[item.materialGrade]} />
        )}
        {item.region && <Fact label="지역" value={item.region.sigunguName} />}
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
      </section>

      {/*
        시공자 카드. **컨택 직전 화면의 마지막 블록이다.**
        여기서 "이 사람에게 맡겨도 되나"가 판가름 나므로 판단 근거를 모아 놓는다.
      */}
      <section
        aria-label="시공자"
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-surface)',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
          {/* 사진이 없으니 이름 앞 두 글자로 대신한다. 빈 동그라미보다 사람처럼 보인다. */}
          <span
            aria-hidden="true"
            style={{
              width: 52,
              height: 52,
              flex: '0 0 auto',
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-primary-100)',
              color: 'var(--color-primary-700)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 17,
              fontWeight: 800,
            }}
          >
            {item.pro.businessName.slice(0, 2)}
          </span>

          <span
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              minWidth: 0,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 17, fontWeight: 800 }}>{item.pro.businessName}</strong>
              {/*
                시안은 인증이라는 말을 썼지만 그건 도메인 용어집 금지어다.
                DB 컬럼이 is_approved 이므로 화면도 승인으로 말한다.
                아껴 쓰는 secondary 색을 여기 쓴다 — 신뢰 신호에만 쓰기로 한 색이다.
              */}
              {item.pro.isApproved && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    height: 22,
                    padding: '0 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-secondary-100)',
                    color: 'var(--color-secondary-600)',
                    border: '1px solid var(--color-secondary-300)',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  승인 시공자
                </span>
              )}
            </span>

            <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
              {[
                item.categories.map((c) => c.nameKo).join('·') || null,
                item.pro.careerYears > 0 ? `경력 ${item.pro.careerYears}년` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>

            {item.pro.serviceAreas.length > 0 && (
              <span style={{ fontSize: 14, color: 'var(--color-text-tertiary)' }}>
                {item.pro.serviceAreas.map((a) => a.sigunguName).join(' · ')}
              </span>
            )}
          </span>
        </div>

        {item.pro.intro && (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)' }}>
            {item.pro.intro}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            borderTop: '1px solid var(--color-border)',
            paddingTop: 'var(--space-4)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
            }}
          >
            {item.isCostPublic ? (
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-success)' }}>
                비용 공개
              </span>
            ) : (
              <span />
            )}
            {/*
              **언제 연락처가 열리는지 미리 말한다.** 이게 없으면 문의 버튼을 누른 사람이
              바로 번호를 볼 거라 기대하고, 기대가 어긋나면 그게 불신이 된다.
            */}
            <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>
              연락처는 수락 후 공개
            </span>
          </div>

          {/*
            문의 화면으로 바로 보낸다. 비로그인이면 거기서 로그인으로 튕기고,
            로그인 뒤 다시 여기로 돌아온다 — 로그인 여부를 SSR이 알 수 없으므로
            판단을 클라이언트 쪽 화면 하나에 몰아둔다.
          */}
          <a
            href={`/contacts/new?portfolioItemId=${item.id}`}
            role="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 48,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-primary-500)',
              color: 'var(--color-text-inverse)',
              fontSize: 15,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            이 시공자에게 문의
          </a>
        </div>
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
  priority,
}: {
  image: PortfolioImage;
  caption?: string;
  alt: string;
  /** 첫 화면에 보이는 사진. 늦게 불러오면 그게 곧 체감 로딩 시간이 된다. */
  priority?: boolean;
}) {
  const src = imageUrl(image.thumb1200Key ?? image.thumb400Key);
  if (!src) return null;
  return (
    <figure style={{ margin: 0, position: 'relative' }}>
      {/*
        width·height 를 적어야 브라우저가 사진이 도착하기 전에 자리를 잡는다.
        없으면 높이 0으로 그렸다가 사진이 오는 순간 아래 글이 통째로 밀린다.
        CSS 로 폭을 100% 로 늘리므로 height:auto 를 같이 줘야 비율이 안 깨진다.
      */}
      <img
        src={src}
        alt={caption ? `${alt} ${caption}` : alt}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        style={{
          width: '100%',
          height: 'auto',
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

/**
 * 시공 조건 한 칸.
 *
 * `<dl>` 이 아니라 칸이다. 값의 성격이 제각각(공종·면적·기간·금액)이라
 * 세로로 정렬해봐야 읽히지 않고, 시안도 2열 카드로 깔았다.
 */
function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-subtle)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
        {value}
        {sub && (
          <span
            style={{
              fontWeight: 400,
              fontSize: 13,
              color: 'var(--color-text-tertiary)',
              marginLeft: 'var(--space-2)',
            }}
          >
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}
