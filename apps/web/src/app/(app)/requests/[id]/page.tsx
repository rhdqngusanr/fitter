'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import {
  HOUSING_TYPE_LABELS,
  MATERIAL_GRADE_LABELS,
  SQUARE_METERS_PER_PYEONG,
  type HousingType,
  type MaterialGrade,
} from '@fitter/shared';

import { Avatar } from '../../../../components/ui/Avatar';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { PhotoImg } from '../../../../components/ui/PhotoImg';
import { ApiError, imageUrl } from '../../../../lib/api';
import { useSession } from '../../../../lib/session';

interface RequestImage {
  id: string;
  thumb400Key: string | null;
  thumb1200Key: string | null;
  isCover: boolean;
}

interface RequestDetail {
  id: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'HIDDEN';
  areaPyeong: string | number | null;
  areaM2: number | null;
  housingType: HousingType | null;
  materialGrade: MaterialGrade | null;
  isOccupied: boolean | null;
  desiredStartAt: string | null;
  desiredEndAt: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  description: string | null;
  viewCount: number;
  createdAt: string;
  images: RequestImage[];
  categories: { code: string; nameKo: string }[];
  region: { code: string; sidoName: string; sigunguName: string } | null;
}

interface Proposal {
  id: string;
  status: 'REQUESTED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
  message: string;
  proposedAmount: number | null;
  proposedAmountNote: string | null;
  createdAt: string;
  pro: {
    id: string;
    businessName: string;
    careerYears: number;
    isApproved: boolean;
    categories: { code: string; nameKo: string }[];
    serviceAreas: string[];
    hasPublicProfile: boolean;
  };
  recentCovers: { id: string; coverThumbKey: string | null }[];
}

type Sort = 'latest' | 'cheapest';

/**
 * `publish` 가 400 으로 돌려주는 `details.missing` 의 필드 이름들.
 * 서버 필드명을 화면에 그대로 내보이면 사용자는 뭘 고쳐야 할지 모른다.
 */
const MISSING_LABELS: Record<string, string> = {
  title: '제목',
  regionCode: '지역',
  housingType: '주거형태',
  areaPyeong: '평형',
  images: '사진 1장 이상',
};

/** 만원 단위로 줄인다. 780000 → "78만원". 십만 원 아래는 그대로 적는다. */
function money(amount: number): string {
  if (amount >= 10000 && amount % 10000 === 0) return `${amount / 10000}만원`;
  return `${amount.toLocaleString('ko-KR')}원`;
}

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return '방금';
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '어제' : `${days}일 전`;
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

/**
 * 의뢰 상세 (C-03) — 내 의뢰.
 *
 * **이 화면의 목적은 하나다. 받은 제안을 비교하고 한 명을 고르는 것.**
 * 그래서 제안 카드가 시공자의 사례 사진 3장과 금액을 함께 들고 있다 —
 * 프로필로 나갔다 돌아오게 만들면 비교가 끊긴다.
 *
 * 전에는 이 화면이 없어서 고객이 제안을 `/contacts` 의 평평한 목록으로만 봤고,
 * **자기 의뢰를 마감할 방법도 없었다**(API 는 있는데 부르는 화면이 없었다).
 *
 * 시안: design/C-03 의뢰 상세(내 것).dc.html (6상태)
 */
export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { user, loading, authFetch } = useSession();

  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('latest');

  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const ready = !loading && !!user;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(`/requests/${id}`)}`);
    }
  }, [loading, user, router, id]);

  const load = useCallback(async () => {
    const [d, p] = await Promise.all([
      authFetch<RequestDetail>(`/reference-requests/${id}`),
      authFetch<{ items: Proposal[] }>(`/reference-requests/${id}/proposals`),
    ]);
    setDetail(d);
    setProposals(p.items);
  }, [authFetch, id]);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    void load().catch((err: unknown) => {
      if (!alive) return;
      setLoadError(
        err instanceof ApiError && err.status === 404
          ? '의뢰를 찾을 수 없습니다. 삭제되었거나 내 의뢰가 아닙니다.'
          : '의뢰를 불러오지 못했습니다.',
      );
    });
    return () => {
      alive = false;
    };
  }, [ready, load]);

  /**
   * 정렬은 화면에서 한다.
   *
   * 시안은 `최신순 · 낮은 비용순 · 시공 건수순` 셋을 그렸는데 **시공 건수를 세는 곳이
   * 없어서** 둘만 남겼다. 한 의뢰의 제안은 많아도 수십 건이라 서버 정렬을 붙일 이유가
   * 없다 — 커서는 최신순 하나로 유지하고 화면이 다시 늘어놓는다.
   */
  const sorted = useMemo(() => {
    if (!proposals) return null;
    const list = [...proposals];
    if (sort === 'cheapest') {
      /* 금액을 안 적은 제안은 끝으로 보낸다. 0원으로 취급하면 맨 앞에 선다. */
      list.sort((a, b) => {
        if (a.proposedAmount === null) return 1;
        if (b.proposedAmount === null) return -1;
        return a.proposedAmount - b.proposedAmount;
      });
    }
    /* 수락한 제안은 정렬과 무관하게 맨 위에 고정된다. */
    list.sort((a, b) => Number(b.status === 'ACCEPTED') - Number(a.status === 'ACCEPTED'));
    return list;
  }, [proposals, sort]);

  async function accept(contactId: string) {
    setBusy(contactId);
    setActionError(null);
    try {
      await authFetch(`/contacts/${contactId}/accept`, { method: 'POST' });
      await load();
    } catch (err: unknown) {
      setActionError(
        err instanceof ApiError ? err.message : '수락에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function close() {
    setBusy('close');
    setActionError(null);
    try {
      await authFetch(`/reference-requests/${id}/close`, { method: 'POST' });
      setClosing(false);
      await load();
    } catch (err: unknown) {
      setActionError(err instanceof ApiError ? err.message : '마감에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  /**
   * 다시 열기. 별도 API 가 아니라 `publish` 를 다시 부른다 — 필수 항목을 재검증한다.
   *
   * **재검증이 실패할 수 있다.** 공개된 적이 있으면 사진이 1장 이상이었지만
   * 그 사이 사진을 지웠으면 다시 열리지 않는다. 브라우저에서 그 400 을 실제로 받아봤고,
   * 서버 메시지("필수 항목이 비어 있습니다")만으로는 무엇을 고쳐야 할지 알 수 없었다.
   * `details.missing` 을 사람 말로 바꿔 보여준다.
   */
  async function reopen() {
    setBusy('reopen');
    setActionError(null);
    try {
      await authFetch(`/reference-requests/${id}/publish`, { method: 'POST' });
      await load();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const missing = (err.details as { missing?: string[] } | undefined)?.missing ?? [];
        const named = missing.map((k) => MISSING_LABELS[k] ?? k).filter(Boolean);
        setActionError(
          named.length > 0
            ? `다시 열려면 ${named.join(' · ')}이 필요합니다.`
            : err.message,
        );
      } else {
        setActionError('다시 열지 못했습니다.');
      }
    } finally {
      setBusy(null);
    }
  }

  if (loadError) {
    return (
      <main className="shell shell--content req">
        <div className="empty">
          <strong className="empty__title">의뢰를 볼 수 없습니다</strong>
          <p className="empty__body">{loadError}</p>
          <Link className="btn btn--primary btn--md" href="/requests/mine">
            내 의뢰 목록
          </Link>
        </div>
      </main>
    );
  }

  /* 로딩 스켈레톤. 시안이 제목·상태 칩 자리를 먼저 잡는 이유는 레이아웃이 흔들리지 않게다. */
  if (!detail || !sorted) {
    return (
      <main className="shell shell--content req" aria-busy="true">
        <div className="req__head">
          <span className="skeleton" style={{ width: '120px', height: '26px' }} />
          <span className="skeleton" style={{ width: '70%', maxWidth: '520px', height: '34px' }} />
          <span className="skeleton" style={{ width: '50%', maxWidth: '400px', height: '20px' }} />
        </div>
        <span
          className="skeleton"
          style={{ height: '274px', borderRadius: 'var(--radius-lg)', display: 'block' }}
        />
      </main>
    );
  }

  const closed = detail.status === 'CLOSED';
  const acceptedCount = sorted.filter((p) => p.status === 'ACCEPTED').length;
  const pyeong = detail.areaPyeong === null ? null : Number(detail.areaPyeong);
  const m2 = pyeong === null ? null : Math.round(pyeong * SQUARE_METERS_PER_PYEONG);

  const statusTone = closed ? 'muted' : acceptedCount > 0 ? 'success' : 'info';
  const statusLabel = closed ? '마감됨' : acceptedCount > 0 ? '시공자 선택됨' : '제안 받는 중';

  const budget =
    detail.budgetMin && detail.budgetMax
      ? `${money(detail.budgetMin)}~${money(detail.budgetMax)}`
      : detail.budgetMax
        ? `${money(detail.budgetMax)} 이하`
        : detail.budgetMin
          ? `${money(detail.budgetMin)} 이상`
          : null;

  const specs: { label: string; value: string }[] = [
    { label: '공종', value: detail.categories.map((c) => c.nameKo).join(' · ') || '미지정' },
    {
      label: '위치',
      value: detail.region ? `${detail.region.sidoName} ${detail.region.sigunguName}` : '미지정',
    },
    ...(pyeong !== null ? [{ label: '면적', value: `${pyeong}평 (${m2}㎡)` }] : []),
    ...(detail.housingType
      ? [{ label: '주거형태', value: HOUSING_TYPE_LABELS[detail.housingType] }]
      : []),
    ...(detail.desiredStartAt ? [{ label: '희망일', value: day(detail.desiredStartAt) }] : []),
    ...(budget ? [{ label: '예산', value: budget }] : []),
    ...(detail.materialGrade
      ? [{ label: '자재', value: MATERIAL_GRADE_LABELS[detail.materialGrade] }]
      : []),
    ...(detail.isOccupied === null
      ? []
      : [{ label: '거주 여부', value: detail.isOccupied ? '거주 중' : '이사 전 공실' }]),
  ];

  const covers = detail.images.slice(0, 4);
  const moreCount = Math.max(0, detail.images.length - 4);

  return (
    <main className="shell shell--content req">
      <nav className="req__crumb" aria-label="위치">
        <Link href="/requests/mine">내 의뢰</Link>
        <span aria-hidden="true">/</span>
        <span>{detail.title}</span>
      </nav>

      <div className="req__head">
        <div className="req__status-row">
          <Badge tone={statusTone}>{statusLabel}</Badge>
          <span className="req__stamp">
            {day(detail.createdAt)} 등록 · 조회 {detail.viewCount}
          </span>
        </div>
        <h1 className="req__h1">{detail.title}</h1>
      </div>

      {closed && (
        <div className="req-closed">
          <span className="req-closed__text">
            <strong>마감한 의뢰입니다</strong>
            {/*
              시안은 "7월 31일까지 다시 열 수 있습니다"라고 적었지만 **마감 시각을 남기는
              컬럼이 없고 기한을 강제하는 곳도 없다.** 지킬 수 없는 날짜를 적지 않는다.
            */}
            <span>새 제안은 오지 않습니다. 다시 열면 목록에 되돌아갑니다.</span>
          </span>
          <Button variant="secondary" size="sm" pending={busy === 'reopen'} onClick={() => void reopen()}>
            다시 열기
          </Button>
        </div>
      )}

      {covers.length > 0 && (
        <div className="req__photos">
          {covers.map((img, i) => {
            const src = imageUrl(i === 0 ? (img.thumb1200Key ?? img.thumb400Key) : img.thumb400Key);
            return (
              <span key={img.id} className="req__photo">
                {src && <PhotoImg src={src} alt="" />}
                {i === 3 && moreCount > 0 && (
                  <span className="req__photo-more">+{moreCount}</span>
                )}
              </span>
            );
          })}
        </div>
      )}

      <div className="split">
        <div>
          <section className="req-specs">
            <strong className="req-specs__title">의뢰 내용</strong>
            <div className="req-specs__grid">
              {specs.map((s) => (
                <span key={s.label} className="req-spec">
                  <span className="req-spec__label">{s.label}</span>
                  <span className="req-spec__value">{s.value}</span>
                </span>
              ))}
            </div>
            {detail.description && <p className="req-specs__desc">{detail.description}</p>}
          </section>

          <div className="req-proposals__head">
            <strong className="req-proposals__title">받은 제안 {sorted.length}건</strong>
            {sorted.length > 1 && (
              <div className="chip-row chip-row--wrap">
                {(
                  [
                    ['latest', '최신순'],
                    ['cheapest', '낮은 비용순'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className="chip chip--sm"
                    aria-pressed={sort === key}
                    onClick={() => setSort(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {actionError && (
            <p role="alert" className="form-error" style={{ marginBottom: 'var(--space-4)' }}>
              {actionError}
            </p>
          )}

          {sorted.length === 0 ? (
            <div className="req-waiting">
              <strong className="req-waiting__title">아직 제안이 없습니다</strong>
              <span className="req-waiting__body">
                {/*
                  시안은 "보통 4시간 안에 첫 제안이 옵니다"라고 적었다. **그 통계가 없다.**
                  대신 제안이 오게 하려면 무엇을 할 수 있는지만 말한다.
                */}
                공개된 의뢰는 조건이 맞는 시공자의 목록에 올라갑니다. 제안이 늦어진다면 사진을
                더 올리거나, 시공자를 직접 찾아 문의해 보세요.
              </span>
              <div className="req-waiting__actions">
                <Link className="btn btn--primary btn--md" href="/pros">
                  시공자 직접 찾기
                </Link>
                <Link className="btn btn--secondary btn--md" href="/gallery">
                  시공 사진 보기
                </Link>
              </div>
            </div>
          ) : (
            <div className="req-proposals__list">
              {sorted.map((p) => {
                const isAccepted = p.status === 'ACCEPTED';
                const trade =
                  [
                    p.pro.categories.map((c) => c.nameKo).join('·'),
                    p.pro.careerYears > 0 ? `경력 ${p.pro.careerYears}년` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '공종 미지정';

                return (
                  <article
                    key={p.id}
                    className={`prop${isAccepted ? ' prop--accepted' : ''}${
                      closed && !isAccepted ? ' prop--dimmed' : ''
                    }`}
                  >
                    {isAccepted && (
                      <span className="prop__accepted-chip">수락함 · 연락처 공개됨</span>
                    )}

                    <div className="prop__top">
                      <div className="prop__who">
                        <Avatar name={p.pro.businessName} size={52} />
                        <span className="prop__ident">
                          <span className="prop__name-row">
                            <strong className="prop__name">{p.pro.businessName}</strong>
                            {p.pro.isApproved ? (
                              <Badge tone="verified" size="xs">
                                승인 시공자
                              </Badge>
                            ) : (
                              <Badge tone="muted" size="xs">
                                미승인
                              </Badge>
                            )}
                          </span>
                          <span className="prop__trade">{trade}</span>
                          <span className="prop__region">
                            {p.pro.serviceAreas.slice(0, 3).join('·') || '지역 미지정'} ·{' '}
                            {ago(p.createdAt)}
                          </span>
                        </span>
                      </div>
                      <span className="prop__price-col">
                        {p.proposedAmount === null ? (
                          /* 금액을 안 적은 건 정당한 경우다("현장 봐야 안다"). 0원으로 보이면 안 된다. */
                          <strong className="prop__price prop__price--none">금액 미제시</strong>
                        ) : (
                          <strong className="prop__price">{money(p.proposedAmount)}</strong>
                        )}
                        {p.proposedAmountNote && (
                          <span className="prop__price-note">{p.proposedAmountNote}</span>
                        )}
                      </span>
                    </div>

                    <p className="prop__msg">{p.message}</p>

                    {p.recentCovers.length > 0 && (
                      <div className="prop__shots">
                        {p.recentCovers.map((c) => {
                          const src = imageUrl(c.coverThumbKey);
                          return (
                            <Link
                              key={c.id}
                              className="prop__shot"
                              href={`/gallery/${c.id}`}
                              aria-label="이 시공자의 시공 사례 보기"
                            >
                              {src && <PhotoImg src={src} alt="" />}
                            </Link>
                          );
                        })}
                      </div>
                    )}

                    {closed ? (
                      <div className="prop__closed-note">
                        {isAccepted
                          ? '마감된 의뢰 · 연락처는 문의함에서 계속 볼 수 있습니다'
                          : '마감된 의뢰 · 더 이상 수락할 수 없습니다'}
                      </div>
                    ) : (
                      <div className="prop__actions">
                        {isAccepted ? (
                          <Link className="btn btn--primary btn--md" href={`/contacts/${p.id}`}>
                            연락처 보기
                          </Link>
                        ) : (
                          <Button
                            pending={busy === p.id}
                            disabled={p.status !== 'REQUESTED'}
                            onClick={() => void accept(p.id)}
                          >
                            {p.status === 'REQUESTED' ? '수락하고 연락처 열기' : '수락할 수 없음'}
                          </Button>
                        )}
                        {/* 승인된 시공자만 공개 프로필이 있다. 없으면 404 로 보내지 않는다. */}
                        {p.pro.hasPublicProfile && (
                          <Link className="btn btn--secondary btn--md" href={`/pros/${p.pro.id}`}>
                            프로필 보기
                          </Link>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="split__aside">
          <div className="req-side">
            {/*
              **제안이 0건인 것과 아직 수락하지 않은 것은 다르다.** 처음에는 둘을
              같은 문장으로 묶어서, 제안 3건이 바로 옆에 깔린 화면이 "제안을 기다리는 중"
              이라고 말했다. 옆의 목록과 모순되는 패널은 없는 게 낫다.
            */}
            <strong className="req-side__title">
              {closed
                ? '마감한 의뢰입니다'
                : acceptedCount > 0
                  ? '시공자를 골랐습니다'
                  : sorted.length > 0
                    ? '제안이 들어오고 있습니다'
                    : '제안을 기다리는 중'}
            </strong>
            <span className="req-side__note">
              {closed
                ? '다시 열면 조건에 맞는 시공자 목록에 되돌아갑니다.'
                : sorted.length === 0
                  ? '공개된 의뢰는 조건이 맞는 시공자의 목록에 올라갑니다.'
                  : '수락은 여러 건 할 수 있습니다. 수락한 시공자에게만 연락처가 열립니다.'}
            </span>

            <div className="req-side__stats">
              <span className="req-side__stat">
                <span className="req-side__stat-label">받은 제안</span>
                <span className="req-side__stat-value">{sorted.length}건</span>
              </span>
              <span className="req-side__stat">
                <span className="req-side__stat-label">수락함</span>
                <span className="req-side__stat-value">{acceptedCount}건</span>
              </span>
              {sorted.length > 0 && (
                <span className="req-side__stat">
                  <span className="req-side__stat-label">가장 최근 제안</span>
                  <span className="req-side__stat-value">
                    {ago(
                      sorted.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)).createdAt,
                    )}
                  </span>
                </span>
              )}
              {/*
                시안의 `노출된 시공자 14명` 은 넣지 않았다 — 그 수를 세는 곳이 없다.
                조회수는 컬럼이 있어 상단에 실었다.
              */}
            </div>

            <div className="req-side__actions">
              {closed ? (
                <Button block pending={busy === 'reopen'} onClick={() => void reopen()}>
                  의뢰 다시 열기
                </Button>
              ) : (
                <Button
                  variant="danger-ghost"
                  block
                  onClick={() => setClosing(true)}
                >
                  의뢰 마감하기
                </Button>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* 모바일 하단 고정. 데스크톱은 우측 패널이 같은 일을 한다. */}
      <div className="sticky-cta">
        {closed ? (
          <Button block pending={busy === 'reopen'} onClick={() => void reopen()}>
            의뢰 다시 열기
          </Button>
        ) : (
          <Button variant="danger-ghost" block onClick={() => setClosing(true)}>
            의뢰 마감하기
          </Button>
        )}
      </div>

      {closing && (
        <div
          className="req-close"
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setClosing(false);
          }}
        >
          <div className="req-close__box">
            <h2 id="close-title" className="req-close__title">
              이 의뢰를 마감할까요?
            </h2>
            <p className="req-close__body">
              마감하면 새 제안이 오지 않고 시공자의 의뢰 목록에서 내려갑니다. 이미 수락한
              시공자와의 연락은 그대로 유지되고, 언제든 다시 열 수 있습니다.
            </p>
            {/*
              시안의 `마감 사유 (선택)` 칩 넷은 넣지 않았다 — **저장할 컬럼이 없다.**
              고르게 해두고 버리면 물어본 척만 하는 화면이 된다.
            */}
            <div className="req-close__actions">
              <Button variant="secondary" onClick={() => setClosing(false)}>
                돌아가기
              </Button>
              <Button variant="danger" pending={busy === 'close'} onClick={() => void close()}>
                마감하기
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
