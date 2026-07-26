'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  HOUSING_TYPE_LABELS,
  MATERIAL_GRADE_LABELS,
  type HousingType,
  type MaterialGrade,
} from '@fitter/shared';

import { ago } from '../../../../components/ContactList';
import { PortfolioPhotos } from '../../../../components/PortfolioPhotos';
import { Avatar } from '../../../../components/ui/Avatar';
import { Button } from '../../../../components/ui/Button';
import { ApiError, type PortfolioImage } from '../../../../lib/api';
import { useSession } from '../../../../lib/session';

interface JobDetail {
  id: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  areaPyeong: string | null;
  areaM2: number | null;
  housingType: HousingType | null;
  materialGrade: MaterialGrade | null;
  isOccupied: boolean;
  floor: number | null;
  hasElevator: boolean | null;
  needsDemolition: boolean | null;
  desiredStartAt: string | null;
  desiredEndAt: string | null;
  createdAt: string;
  images: PortfolioImage[];
  categories: { code: string; nameKo: string }[];
  region: { code: string; sidoName: string; sigunguName: string } | null;
}

interface ProProfile {
  businessName: string;
  isApproved: boolean;
  serviceAreas?: { code: string; sigunguName: string }[];
}

/**
 * 의뢰 상세 (P-05).
 *
 * **시공자가 "이 일감을 할지" 판단하고 제안을 보내는 화면이다.**
 * 그래서 우측 제안 패널이 스크롤을 따라다닌다 — 사진과 조건을 훑는 동안
 * 제안 수단이 화면에서 사라지면 안 된다.
 *
 * 시안이 정한 것 중 이 화면의 핵심 둘.
 * - **미승인이면 제안만 잠근다.** 열람까지 막으면 승인을 기다릴 동기가 사라진다.
 * - **내 활동 지역 밖이면 알려주되 막지 않는다.** 출장을 갈지는 시공자가 정할 일이다.
 *
 * 근거: design/P-04 P-05 의뢰 목록·상세.dc.html · brain/20-도메인/상태머신 - 컨택.md
 */
export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading, authFetch } = useSession();
  const router = useRouter();

  const [job, setJob] = useState<JobDetail | null>(null);
  const [profile, setProfile] = useState<ProProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  /** 이미 제안한 의뢰. 서버가 중복을 막으므로 그 응답으로 알게 된다. */
  const [already, setAlready] = useState(false);

  const load = useCallback(async () => {
    const res = await authFetch<JobDetail>(`/reference-requests/${id}`);
    setJob(res);
  }, [authFetch, id]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(`/jobs/${id}`)}`);
      return;
    }
    if (user.profileType !== 'PRO') {
      router.replace('/');
      return;
    }
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.message : '불러오지 못했습니다.');
    });
    void authFetch<ProProfile>('/me/pro-profile')
      .then(setProfile)
      .catch(() => {});
  }, [loading, user, id, load, authFetch, router]);

  if (loading || user?.profileType !== 'PRO') return null;

  if (!job) {
    return (
      <div className="job-detail">
        {error && (
          <p role="alert" className="gallery-error">
            {error}
          </p>
        )}
      </div>
    );
  }

  /* 미승인은 열람만 된다. 제안은 서버도 막지만 화면이 먼저 이유를 말한다. */
  const locked = profile ? !profile.isApproved : false;
  const closed = job.status !== 'PUBLISHED';
  /*
   * 내 활동 지역 밖인가. 등록된 지역이 없으면 판단하지 않는다 —
   * 모르는 걸 "밖이다"라고 말하면 멀쩡한 일감을 놓치게 만든다.
   */
  const areas = profile?.serviceAreas ?? [];
  const outOfArea =
    areas.length > 0 && !!job.region && !areas.some((a) => a.code === job.region?.code);

  async function propose() {
    if (!message.trim()) return;
    setError(null);
    setPending(true);
    try {
      const created = await authFetch<{ id: string }>('/contacts', {
        method: 'POST',
        body: JSON.stringify({
          direction: 'PRO_TO_REQUEST',
          referenceRequestId: id,
          message: message.trim(),
          ...(amount ? { proposedAmount: Number(amount) } : {}),
        }),
      });
      router.push(`/contacts/${created.id}`);
    } catch (err) {
      /*
       * 같은 의뢰에 두 번 제안할 수 없다(DB 제약). 그 실패는 에러가 아니라 상태다 —
       * 시안의 "이미 제안함"이 이 경우다. 빨간 글씨 대신 그 사실을 보여준다.
       */
      if (err instanceof ApiError && (err.status === 409 || err.code === 'CONFLICT')) {
        setAlready(true);
      } else {
        setError(err instanceof ApiError ? err.message : '제안을 보내지 못했습니다.');
      }
      setPending(false);
    }
  }

  const when = job.desiredStartAt
    ? `${new Date(job.desiredStartAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}부터`
    : '미정';

  return (
    <div className="job-detail">
      <div className="detail-back">
        <a href="/jobs" className="btn btn--secondary btn--sm">
          ← 의뢰 목록
        </a>
        <span className="detail-back__meta">
          {[`${ago(job.createdAt)} 등록`, job.region?.sigunguName].filter(Boolean).join(' · ')}
        </span>
      </div>

      <div className="job-detail__body">
        <div className="job-detail__main">
          {/*
            의뢰 사진. 포트폴리오와 같은 부품을 쓴다 — 사진을 고르고 크게 보는 동작은
            어느 화면에서든 같아야 한다. 다만 여기 사진은 **고객이 올린 레퍼런스**다.
          */}
          <PortfolioPhotos images={job.images} title={job.title} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="job-card__badges">
              {job.categories.map((c) => (
                <span key={c.code} className="badge badge--info">
                  {c.nameKo}
                </span>
              ))}
              {job.isOccupied && <span className="badge badge--neutral">거주 중</span>}
              {job.needsDemolition && <span className="badge badge--warning">철거 필요</span>}
              {closed && <span className="badge badge--muted">마감됨</span>}
            </div>
            <h1 className="job-detail__h1">{job.title}</h1>
          </div>

          <section aria-label="의뢰 조건" className="job-detail__specs">
            {job.categories.length > 0 && (
              <Spec k="공종" v={job.categories.map((c) => c.nameKo).join('·')} />
            )}
            {job.areaPyeong && (
              <Spec
                k="규모"
                v={[
                  `${Number(job.areaPyeong)}평`,
                  job.housingType ? HOUSING_TYPE_LABELS[job.housingType] : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                sub={job.areaM2 ? `${job.areaM2.toFixed(1)}㎡` : undefined}
              />
            )}
            {job.region && <Spec k="지역" v={`${job.region.sidoName} ${job.region.sigunguName}`} />}
            <Spec k="희망 시기" v={when} />
            {job.materialGrade && (
              <Spec k="자재 등급" v={MATERIAL_GRADE_LABELS[job.materialGrade]} />
            )}
            {/*
              층수·엘리베이터는 자재 운반비를 가른다. 고객이 안 적었으면 칸을 만들지 않는다 —
              "미입력"을 보여주는 건 정보가 아니라 소음이다.
            */}
            {job.floor !== null && (
              <Spec
                k="층"
                v={`${job.floor}층${job.hasElevator === null ? '' : job.hasElevator ? ' · 엘리베이터 있음' : ' · 엘리베이터 없음'}`}
              />
            )}
          </section>

          {job.description && (
            <section className="detail-note">
              <span className="detail-note__title">고객이 덧붙인 말</span>
              <p className="detail-note__body">{job.description}</p>
            </section>
          )}

          <div className="job-customer">
            <Avatar name="고객" size={52} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="job-customer__name">의뢰한 고객</span>
              {/*
                시안은 여기에 `의뢰 3건 · 컨택 수락률 67%` 를 적는다. 그 집계 API 가 없고,
                **고객 신원은 수락 전에는 열지 않는 게 이 서비스의 규칙**이라 이름도 쓰지 않는다.
              */}
              <span className="job-customer__meta">
                이름과 연락처는 고객이 제안을 수락한 뒤에 열립니다.
              </span>
            </span>
          </div>
        </div>

        <aside aria-label="제안">
          <div className="proposal">
            {outOfArea && (
              <div className="proposal__warn">
                <strong>내 활동 지역 밖</strong>
                <span>
                  등록 지역: {areas.map((a) => a.sigunguName).join(' · ')}. 제안은 보낼 수 있지만
                  출장비를 미리 알려주세요.
                </span>
              </div>
            )}

            {error && (
              <p role="alert" className="gallery-error">
                {error}
              </p>
            )}

            {closed ? (
              <>
                <strong className="proposal__title">마감된 의뢰입니다</strong>
                <span className="proposal__body">
                  고객이 이 의뢰를 닫았습니다. 비슷한 조건의 일감을 계속 받아보세요.
                </span>
                <a href="/jobs" className="btn btn--secondary btn--lg btn--block">
                  비슷한 의뢰 보기
                </a>
              </>
            ) : already ? (
              <>
                <span className="badge badge--warning" style={{ width: 'fit-content' }}>
                  제안 보냄 · 응답 대기
                </span>
                <strong className="proposal__title">이미 제안한 의뢰입니다</strong>
                <span className="proposal__body">
                  같은 의뢰에 두 번 제안할 수 없습니다. 보낸 내용과 진행 상태는 컨택에서 볼 수
                  있습니다.
                </span>
                <a href="/contacts?box=sent" className="btn btn--secondary btn--lg btn--block">
                  보낸 컨택 보기
                </a>
              </>
            ) : (
              <>
                <strong className="proposal__title">이 의뢰에 제안하기</strong>
                <span className="proposal__body">
                  가능 일정과 방식만 간단히 적어주세요. 금액은 현장 확인 후 정해도 됩니다.
                </span>

                <textarea
                  className="input"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  disabled={locked || pending}
                  placeholder="예) 거실 실크 + 아이방 합지로 가능합니다. 토요일 시공 가능합니다."
                  aria-label="제안 메시지"
                />

                {/*
                  제안 금액은 **선택**이다. 필수로 하면 "현장을 봐야 안다"는 정당한 경우를
                  막고 시공자가 이탈한다. 그래도 받아두는 이유는 이게 2차 가격 통계의
                  1차 데이터원이기 때문이다 — 거래는 밖에서 성사돼도 제안은 안에서 일어난다.
                */}
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={locked || pending}
                  placeholder="예상 금액 (선택, 원)"
                  aria-label="예상 금액"
                />

                {locked && (
                  <div className="proposal__warn">
                    <strong>승인이 끝나면 제안할 수 있습니다</strong>
                    <span>사업자·자격 확인은 보통 1영업일 걸립니다. 그동안 열람은 됩니다.</span>
                  </div>
                )}

                <Button
                  variant="primary"
                  size="lg"
                  block
                  pending={pending}
                  disabled={locked || !message.trim()}
                  onClick={() => void propose()}
                >
                  제안 보내기
                </Button>

                <span className="proposal__note">
                  제안을 보내면 고객에게 알림이 갑니다. 연락처는 고객이 수락한 뒤에 열립니다.
                </span>
              </>
            )}
          </div>
        </aside>
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
