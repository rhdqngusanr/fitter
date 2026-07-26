import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Avatar } from '../../../../components/ui/Avatar';
import { PhotoCard } from '../../../../components/ui/PhotoCard';
import { api, ApiError, imageUrl } from '../../../../lib/api';

interface ProDetail {
  id: string;
  businessName: string;
  intro: string | null;
  careerYears: number;
  joinedAt: string;
  categories: { code: string; nameKo: string }[];
  serviceAreas: { code: string; sigunguName: string }[];
  portfolioCount: number;
  hasCostPublic: boolean;
  portfolios: {
    id: string;
    title: string;
    areaPyeong: string | null;
    isCostPublic: boolean;
    workedAt: string | null;
    coverThumbKey: string | null;
    photoCount: number;
    categories: { code: string; nameKo: string }[];
    region: { code: string; sigunguName: string } | null;
  }[];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 0;

async function load(id: string): Promise<ProDetail> {
  try {
    return await api<ProDetail>(`/pros/${id}`, { revalidate: 0 });
  } catch (error) {
    /* 없는 시공자·미승인·휴면이 전부 같은 404 다. 구분하면 "존재한다"가 샌다. */
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const pro = await load(id);
  return {
    title: pro.businessName,
    description:
      pro.intro ??
      `${pro.categories.map((c) => c.nameKo).join('·')} · 경력 ${pro.careerYears}년 · 등록한 사례 ${pro.portfolioCount}건`,
  };
}

/**
 * 시공자 프로필 (C-07).
 *
 * **컨택 직전 화면이다.** C-05(사례 상세)가 "이 작업이 마음에 드는가"를 묻는다면
 * 여기는 "이 사람에게 맡겨도 되는가"를 묻는다. 그래서 사람에 대한 근거를 모으고
 * 사례는 그 근거의 하나로 아래에 깐다.
 *
 * **연락처는 어느 경로로도 여기 오지 않는다.** 응답에 `phone` 키 자체가 없다.
 *
 * 근거: design/C-06 C-07 시공자 목록·상세.dc.html · brain/50-결정/ADR-011 - 신뢰 장치 설계.md
 */
export default async function ProDetailPage({ params }: PageProps) {
  const { id } = await params;
  const pro = await load(id);

  const joined = new Date(pro.joinedAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
  });

  return (
    <main className="pro-detail">
      <div className="detail-back">
        <a href="/pros" className="btn btn--secondary btn--sm">
          ← 시공자 찾기
        </a>
        <span className="detail-back__meta">
          {[pro.categories.map((c) => c.nameKo).join('·') || null, `${joined} 합류`]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>

      <div className="pro-detail__body">
        <div className="pro-detail__main">
          <div className="pro-detail__head">
            <Avatar name={pro.businessName} size={52} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <strong className="pro-detail__name">{pro.businessName}</strong>
                <span className="badge badge--verified">승인 시공자</span>
                {pro.hasCostPublic && <span className="badge badge--success">비용 공개</span>}
              </span>
              <span className="pro-detail__meta">
                {[
                  pro.categories.map((c) => c.nameKo).join('·') || null,
                  pro.careerYears > 0 ? `경력 ${pro.careerYears}년` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              {pro.serviceAreas.length > 0 && (
                <span className="pro-detail__area">
                  활동 지역 {pro.serviceAreas.map((a) => a.sigunguName).join(' · ')}
                </span>
              )}
            </div>
          </div>

          {/*
            신뢰 지표. **우리가 실제로 아는 숫자만 넣는다.**
            시안은 `시공 87건 · 응답 3시간 · 수락률 67%` 를 그렸지만 그 집계가 없다 —
            없는 숫자를 지어내면 이 칸 전체가 장식이 된다.
          */}
          <div className="pro-stats">
            <div className="pro-stat">
              <span className="pro-stat__v">{pro.portfolioCount}건</span>
              <span className="pro-stat__k">등록한 사례</span>
            </div>
            <div className="pro-stat">
              <span className="pro-stat__v">{pro.careerYears}년</span>
              <span className="pro-stat__k">경력</span>
            </div>
            <div className="pro-stat">
              <span className="pro-stat__v">{pro.serviceAreas.length}곳</span>
              <span className="pro-stat__k">활동 지역</span>
            </div>
          </div>

          {pro.intro && (
            <section className="detail-note">
              <span className="detail-note__title">시공자 소개</span>
              <p className="detail-note__body">{pro.intro}</p>
            </section>
          )}

          <section className="detail-note">
            <span className="detail-note__title">확인된 정보</span>
            <div>
              <Verified k="사업자 확인" ok />
              <Verified k="관리자 승인" ok />
              <Verified k="비용 공개 사례" ok={pro.hasCostPublic} />
              {/*
                리뷰는 [[ADR-011]]이 최고 ROI 로 꼽았지만 아직 만들지 않았다.
                "없음"이라고 적는 이유는 있는 척하지 않기 위해서다.
              */}
              <Verified k="완료 확인·리뷰" ok={false} note="준비 중" />
            </div>
          </section>

          <section className="detail-note">
            <span className="detail-note__title">포트폴리오 {pro.portfolioCount}건</span>
            {pro.portfolios.length === 0 ? (
              <div className="empty">
                <span className="empty__body">
                  새로 등록한 시공자입니다. 사업자와 경력은 확인되었지만 시공 사진은 아직 없습니다.
                </span>
              </div>
            ) : (
              <ul className="pro-portfolio">
                {pro.portfolios.map((item, index) => (
                  <li key={item.id}>
                    <PhotoCard
                      href={`/gallery/${item.id}`}
                      src={imageUrl(item.coverThumbKey)}
                      alt={item.title}
                      tag={item.categories[0]?.nameKo}
                      count={item.photoCount}
                      title={item.title}
                      meta={[
                        item.region?.sigunguName,
                        item.areaPyeong ? `${Number(item.areaPyeong)}평` : null,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      eager={index < 3}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside aria-label="문의">
          <div className="procard">
            <strong className="procard__name">이 시공자에게 문의</strong>
            <span className="procard__intro">
              마음에 드는 사례를 골라 문의하면 어떤 작업을 보고 연락했는지 시공자가 압니다.
            </span>

            <div className="procard__foot">
              <div className="procard__row">
                {pro.hasCostPublic ? <span className="procard__cost">비용 공개</span> : <span />}
                {/* 언제 연락처가 열리는지 미리 말한다. 이게 없으면 기대가 어긋나고 불신이 된다. */}
                <span className="procard__hint">연락처는 수락 후 공개</span>
              </div>

              {/*
                **문의는 사례를 통해서만 보낸다.** 컨택은 `portfolioItemId` 또는
                `referenceRequestId` 에 매달리기 때문이다 — 무엇을 보고 연락했는지가
                남지 않으면 시공자가 답할 근거도 없다.
                사례가 없는 시공자에게는 의뢰를 올리라고 안내한다.
              */}
              {pro.portfolios[0] ? (
                <a
                  href={`/contacts/new?portfolioItemId=${pro.portfolios[0].id}`}
                  className="btn btn--primary procard__cta"
                >
                  최근 사례로 문의하기
                </a>
              ) : (
                <a href="/requests/new" className="btn btn--primary procard__cta">
                  의뢰 올리고 제안받기
                </a>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Verified({ k, ok, note }: { k: string; ok: boolean; note?: string }) {
  return (
    <div className="pro-verified">
      <span className="pro-verified__k">{k}</span>
      <span className={`pro-verified__v pro-verified__v--${ok ? 'yes' : 'no'}`}>
        {note ?? (ok ? '확인됨' : '없음')}
      </span>
    </div>
  );
}
