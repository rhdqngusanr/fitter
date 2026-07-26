import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { HOUSING_TYPE_LABELS, MATERIAL_GRADE_LABELS } from '@fitter/shared';

import { PortfolioPhotos } from '../../../../components/PortfolioPhotos';
import { Avatar } from '../../../../components/ui/Avatar';
import { api, ApiError, type PortfolioDetail } from '../../../../lib/api';

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
     *
     * 시안은 "삭제된 항목"을 404 대신 설명 화면으로 그렸는데(SEO 링크가 남으므로),
     * 그러려면 API 가 "있었지만 내려갔다"를 구분해서 알려줘야 한다. 지금은 그 구분이
     * 없으므로 `not-found.tsx` 가 같은 역할을 한다 — 막다른 길로 보내지 않는다.
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
 *
 * 시안의 데스크톱은 2단이다 — 본문(사진·제목·스펙·설명)과 우측에 **고정되는** 시공자 카드.
 * 카드가 따라다녀야 사진을 아무리 내려봐도 문의 수단이 화면에 남는다. 구현은 1단이라
 * 시공자 카드가 스크롤 맨 아래 있었고, 그건 이 화면의 목적을 화면 밖에 두는 것이었다.
 *
 * 근거: design/C-04 C-05 포트폴리오 갤러리·상세.dc.html · brain/50-결정/ADR-011 - 신뢰 장치 설계.md
 */
export default async function PortfolioDetailPage({ params }: PageProps) {
  const { id } = await params;
  const item = await load(id);

  const categories = item.categories.map((c) => c.nameKo).join('·');
  const when = item.workedAt
    ? `${item.workedAt.slice(0, 4)}년 ${Number(item.workedAt.slice(5, 7))}월`
    : null;

  return (
    <main
      className="shell"
      style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-12)' }}
    >
      {/* 돌아가는 길과 이 사례가 무엇인지 한 줄. 시안은 이 둘을 같은 줄에 둔다. */}
      <div className="detail-back">
        <a href="/gallery" className="btn btn--secondary btn--sm">
          ← 시공 사진
        </a>
        <span className="detail-back__meta">
          {[categories, item.region?.sigunguName, when].filter(Boolean).join(' · ')}
        </span>
      </div>

      <div className="detail-body">
        <div className="detail-main">
          <PortfolioPhotos images={item.images} title={item.title} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <h1 className="detail-h1">{item.title}</h1>
            <span className="detail-meta">
              {[
                [
                  item.region?.sigunguName,
                  item.areaPyeong ? `${Number(item.areaPyeong)}평` : null,
                  item.housingType ? HOUSING_TYPE_LABELS[item.housingType] : null,
                ]
                  .filter(Boolean)
                  .join(' '),
                when,
                `조회 ${item.viewCount}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>

          {/*
            시공 조건. 시안은 라벨 하나에 값 하나짜리 칸을 데스크톱 3열·모바일 2열로 깐다.
            표가 아니라 칸들인 이유는 값의 성격이 제각각이라 세로 정렬이 의미가 없어서다.
          */}
          <section aria-label="시공 조건" className="detail-specs">
            {categories && <Spec k="공종" v={categories} />}
            {/*
              평수와 주거형태를 한 칸에 묶는다 — 둘 다 "얼마나 큰 집인가"를 말한다.
              ㎡는 서버가 평에서 파생한 값이라 화면이 다시 계산하지 않는다.
            */}
            {item.areaPyeong && (
              <Spec
                k="규모"
                v={[
                  `${Number(item.areaPyeong)}평`,
                  item.housingType ? HOUSING_TYPE_LABELS[item.housingType] : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                sub={item.areaM2 ? `${item.areaM2.toFixed(1)}㎡` : undefined}
              />
            )}
            {item.workDays && <Spec k="기간" v={`${item.workDays}일`} />}
            {item.materialGrade && <Spec k="자재" v={MATERIAL_GRADE_LABELS[item.materialGrade]} />}
            {item.region && <Spec k="지역" v={item.region.sigunguName} />}
            {when && <Spec k="시공 시기" v={when} />}
            {/*
              금액은 공개한 시공자만 보여준다. 비공개면 키 자체가 응답에 없으므로
              "비공개"라는 문구조차 띄우지 않는다 — 안 밝힌 걸 강조할 이유가 없다.
            */}
            {item.actualCost !== undefined && (
              <Spec k="실제 비용" v={`${item.actualCost.toLocaleString('ko-KR')}원`} />
            )}
          </section>

          {item.description && (
            <section className="detail-note">
              <span className="detail-note__title">시공자 설명</span>
              <p className="detail-note__body">{item.description}</p>
            </section>
          )}
        </div>

        <aside className="detail-aside" aria-label="시공자">
          <ProCard item={item} />
        </aside>
      </div>

      {/*
        모바일 하단 고정 CTA. 시안의 모바일 상세는 이 바를 갖고 있다.
        사진을 길게 훑는 화면이라 문의 수단이 스크롤 위치와 무관하게 손에 닿아야 한다.
      */}
      <div className="sticky-cta">
        <a
          href={`/contacts/new?portfolioItemId=${item.id}`}
          className="btn btn--primary btn--lg btn--block"
        >
          이 시공자에게 문의
        </a>
      </div>
    </main>
  );
}

/**
 * 시공자 카드.
 *
 * 여기서 "이 사람에게 맡겨도 되나"가 판가름 나므로 판단 근거를 모아 놓는다.
 * 시안이 적어둔 `시공 87건`·`평균 응답 3시간` 은 집계 API 가 없어서 못 넣었다 —
 * 없는 숫자를 지어내면 그 순간 이 카드의 나머지도 못 믿게 된다.
 */
function ProCard({ item }: { item: PortfolioDetail }) {
  return (
    <div className="procard">
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
        <Avatar name={item.pro.businessName} size={52} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <strong className="procard__name">{item.pro.businessName}</strong>
            {/*
              시안은 다른 낱말을 썼지만 그건 도메인 용어집 금지어다.
              DB 컬럼이 `is_approved` 이므로 화면도 승인으로 말한다.
              아껴 쓰는 secondary 색을 여기 쓴다 — 신뢰 신호에만 쓰기로 한 색이다.
            */}
            {item.pro.isApproved && <span className="badge badge--verified">승인 시공자</span>}
          </span>

          <span className="procard__meta">
            {[
              item.categories.map((c) => c.nameKo).join('·') || null,
              item.pro.careerYears > 0 ? `경력 ${item.pro.careerYears}년` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>

          {item.pro.serviceAreas.length > 0 && (
            <span className="procard__area">
              활동 지역 {item.pro.serviceAreas.map((a) => a.sigunguName).join(' · ')}
            </span>
          )}
        </span>
      </div>

      {item.pro.intro && <p className="procard__intro">{item.pro.intro}</p>}

      <div className="procard__foot">
        <div className="procard__row">
          {item.isCostPublic ? <span className="procard__cost">비용 공개</span> : <span />}
          {/*
            **언제 연락처가 열리는지 미리 말한다.** 이게 없으면 문의 버튼을 누른 사람이
            바로 번호를 볼 거라 기대하고, 기대가 어긋나면 그게 불신이 된다.
          */}
          <span className="procard__hint">연락처는 수락 후 공개</span>
        </div>

        {/*
          문의 화면으로 바로 보낸다. 비로그인이면 거기서 로그인으로 튕기고,
          로그인 뒤 다시 여기로 돌아온다 — 로그인 여부를 SSR이 알 수 없으므로
          판단을 클라이언트 쪽 화면 하나에 몰아둔다.
        */}
        <a
          href={`/contacts/new?portfolioItemId=${item.id}`}
          className="btn btn--primary procard__cta"
        >
          이 시공자에게 문의
        </a>
      </div>
    </div>
  );
}

function Spec({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="detail-spec">
      <span className="detail-spec__k">{k}</span>
      <span className="detail-spec__v">
        {v}
        {sub && <span className="detail-spec__sub">{sub}</span>}
      </span>
    </div>
  );
}
