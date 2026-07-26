'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  HOUSING_TYPE_LABELS,
  MATERIAL_GRADE_LABELS,
  WORK_CATEGORY_SEEDS,
  type HousingType,
  type MaterialGrade,
} from '@fitter/shared';

import { ago } from '../../../components/ContactList';
import { ApiError, api, imageUrl } from '../../../lib/api';
import { useSession } from '../../../lib/session';

interface JobRow {
  id: string;
  title: string;
  areaPyeong: string | null;
  housingType: HousingType | null;
  materialGrade?: MaterialGrade | null;
  isOccupied: boolean;
  desiredStartAt: string | null;
  createdAt: string;
  coverThumbKey: string | null;
  photoCount: number;
  /** 제안이 몇 건 들어갔는지. 시공자가 경쟁 정도를 판단하는 근거다. */
  contactCount: number;
  categories: { code: string; nameKo: string }[];
  region: { code: string; sigunguName: string } | null;
}

interface BrowseResponse {
  hasAnyContent: boolean;
  items: JobRow[];
  nextCursor: string | null;
}

interface RegionTree {
  sido: { code: string; name: string; sigungu: { code: string; name: string }[] }[];
}

interface ProProfile {
  businessName: string;
  isApproved: boolean;
  serviceAreas?: { code: string; sigunguName: string }[];
}

/**
 * 의뢰 목록 (P-04).
 *
 * **이 화면이 없어서 서비스가 한쪽으로만 돌고 있었다.** 고객이 의뢰를 올려도 시공자가
 * 볼 방법이 없었다 — API 는 진작 있었는데 화면이 없었다.
 *
 * 시안의 원칙: **시공자는 현장에서 폰으로 훑는다.** 카드 한 줄에 지역·평형·공종·시기가
 * 다 있어야 스크롤만으로 판단이 끝난다. 그래서 사진은 왼쪽에 작게 붙고 글이 주인공이다.
 *
 * 근거: design/P-04 P-05 의뢰 목록·상세.dc.html
 */
export default function JobsPage() {
  return (
    <Suspense fallback={null}>
      <JobsBrowser />
    </Suspense>
  );
}

function JobsBrowser() {
  const { user, loading, authFetch } = useSession();
  const router = useRouter();
  const params = useSearchParams();

  const selectedCategories = params.get('categories')?.split(',').filter(Boolean) ?? [];
  const selectedRegions = params.get('regions')?.split(',').filter(Boolean) ?? [];
  /* 필터가 바뀌면 다시 불러온다. 배열이 아니라 문자열로 비교해야 참조가 매번 달라지지 않는다. */
  const query = params.toString();

  const [data, setData] = useState<BrowseResponse | null>(null);
  const [regions, setRegions] = useState<RegionTree | null>(null);
  const [profile, setProfile] = useState<ProProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/jobs')}`);
      return;
    }
    /* 일감 목록은 시공자의 화면이다. 서버 가드도 같은 규칙이라 여기서는 안내만 한다. */
    if (user.profileType !== 'PRO') router.replace('/');
  }, [loading, user, router]);

  const ready = !loading && user?.profileType === 'PRO';

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    setData(null);
    void authFetch<BrowseResponse>(`/reference-requests?${query}`)
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof ApiError ? err.message : '불러오지 못했습니다.');
      });
    return () => {
      alive = false;
    };
  }, [ready, authFetch, query]);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    void api<RegionTree>('/regions')
      .then((tree) => {
        if (alive) setRegions(tree);
      })
      .catch(() => {});
    void authFetch<ProProfile>('/me/pro-profile')
      .then((p) => {
        if (alive) setProfile(p);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ready, authFetch]);

  if (loading || user?.profileType !== 'PRO') return null;

  const sigungu = regions?.sido.flatMap((s) => s.sigungu) ?? [];
  const href = (next: { categories?: string[]; regions?: string[] }) => {
    const parts = [
      (next.categories ?? selectedCategories).length
        ? `categories=${(next.categories ?? selectedCategories).join(',')}`
        : '',
      (next.regions ?? selectedRegions).length
        ? `regions=${(next.regions ?? selectedRegions).join(',')}`
        : '',
    ].filter(Boolean);
    return parts.length ? `/jobs?${parts.join('&')}` : '/jobs';
  };
  const toggle = (list: string[], code: string) =>
    list.includes(code) ? list.filter((c) => c !== code) : [...list, code];

  const filtered = selectedCategories.length > 0 || selectedRegions.length > 0;
  /* 미승인 시공자는 열람은 되지만 제안을 못 보낸다. 아예 막으면 승인 동기가 사라진다. */
  const locked = profile ? !profile.isApproved : false;

  return (
    <div className="jobs">
      <aside aria-label="필터" className="jobs__filters">
        <div className="jobs__filter-group">
          <span className="jobs__filter-title">공종</span>
          <div className="chip-row" style={{ flexWrap: 'wrap' }}>
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

        <div className="jobs__filter-group">
          <span className="jobs__filter-title">지역</span>
          <div className="chip-row" style={{ flexWrap: 'wrap' }}>
            <a
              href={href({ regions: [] })}
              className="chip chip--sm"
              aria-pressed={!selectedRegions.length}
            >
              전체
            </a>
            {sigungu.map((g) => (
              <a
                key={g.code}
                href={href({ regions: toggle(selectedRegions, g.code) })}
                className="chip chip--sm"
                aria-pressed={selectedRegions.includes(g.code)}
              >
                {g.name}
              </a>
            ))}
          </div>
          {/*
            내 활동 지역을 알려준다. 시안은 "내 활동 지역만" 체크박스를 주는데,
            그건 프로필의 serviceAreas 로 필터를 미리 채우는 것과 같다 — 아래 버튼이 그 일을 한다.
          */}
          {!!profile?.serviceAreas?.length && (
            <>
              <span className="jobs__filter-note">
                등록된 활동 지역: {profile.serviceAreas.map((a) => a.sigunguName).join(' · ')}
              </span>
              <a
                href={href({ regions: profile.serviceAreas.map((a) => a.code) })}
                className="btn btn--secondary btn--sm"
                style={{ width: 'fit-content' }}
              >
                내 활동 지역만 보기
              </a>
            </>
          )}
        </div>

        {filtered && (
          <a href="/jobs" className="btn btn--secondary btn--md jobs__reset">
            필터 초기화
          </a>
        )}
      </aside>

      <main className="jobs__main">
        {locked && (
          <div className="jobs__locked">
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <strong className="jobs__locked-title">
                승인 대기 중 — 열람은 되지만 제안은 보낼 수 없습니다
              </strong>
              <span className="jobs__locked-body">
                사업자등록증과 시공 이력 확인이 끝나면 바로 열립니다. 보통 1영업일.
              </span>
            </span>
            <a
              href="/portfolios/mine"
              className="btn btn--secondary btn--md"
              style={{ flex: 'none' }}
            >
              내 사례 보기
            </a>
          </div>
        )}

        <div className="jobs__head">
          <h1 className="jobs__h1">
            {data === null
              ? '의뢰 찾기'
              : data.items.length === 0
                ? '조건에 맞는 의뢰 0건'
                : `${data.items.length}건 · 최신순`}
          </h1>
        </div>

        {error && (
          <p role="alert" className="gallery-error">
            {error}
          </p>
        )}

        {data === null ? (
          <JobsSkeleton />
        ) : data.items.length === 0 ? (
          /*
           * 빈 상태를 두 갈래로 나눈다. 갤러리와 같은 원칙이다 —
           * "필터 때문에 0건"과 "아직 아무 의뢰도 없어서 0건"은 다음 할 일이 다르다.
           */
          <div className="empty gallery-empty">
            <span className="empty__icon" aria-hidden="true" />
            <strong className="gallery-empty__title">
              {filtered && data.hasAnyContent
                ? '조건에 맞는 의뢰가 아직 없습니다'
                : '아직 올라온 의뢰가 없습니다'}
            </strong>
            <span className="gallery-empty__body">
              {filtered && data.hasAnyContent
                ? '조건을 넓히면 볼 수 있는 일감이 늘어납니다.'
                : '새 의뢰가 올라오면 여기에 뜹니다. 그동안 포트폴리오를 채워두면 고객이 먼저 문의합니다.'}
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
                <a href="/jobs" className="btn btn--secondary btn--lg">
                  필터 초기화
                </a>
              )}
              <a href="/portfolios/new" className="btn btn--primary btn--lg">
                포트폴리오 등록
              </a>
            </div>
          </div>
        ) : (
          <ul className="jobs__list">
            {data.items.map((job) => (
              <li key={job.id}>
                <JobCard job={job} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

/** 일감 카드 한 장. 시안: 사진(132px) · 뱃지 · 제목 · 조건 · 시기/경쟁. */
function JobCard({ job }: { job: JobRow }) {
  const src = imageUrl(job.coverThumbKey);
  /* 하루가 안 지난 의뢰는 신규다. 시공자에게는 "아직 아무도 안 봤을 수도 있다"가 중요하다. */
  const isNew = Date.now() - new Date(job.createdAt).getTime() < 86400000;

  return (
    <a href={`/jobs/${job.id}`} className="job-card">
      <span className="job-card__media">
        {src && <img src={src} alt="" loading="lazy" />}
        {job.photoCount > 1 && <span className="job-card__more">+{job.photoCount - 1}</span>}
      </span>

      <span className="job-card__body">
        <span className="job-card__badges">
          {job.categories[0] && (
            <span className="badge badge--xs badge--info">{job.categories[0].nameKo}</span>
          )}
          {isNew && <span className="badge badge--xs badge--success">신규</span>}
          {/*
            제안 0건은 **기회**다. 경쟁이 없다는 뜻이라 시공자가 제일 먼저 보고 싶어 한다.
            반대로 5건이면 굳이 안 쓸 수도 있다 — 어느 쪽이든 판단 근거다.
          */}
          {job.contactCount === 0 && (
            <span className="badge badge--xs badge--warning">제안 0건</span>
          )}
        </span>

        <span className="job-card__title">{job.title}</span>

        <span className="job-card__spec">
          {[
            job.region?.sigunguName,
            job.areaPyeong ? `${Number(job.areaPyeong)}평` : null,
            job.housingType ? HOUSING_TYPE_LABELS[job.housingType] : null,
            job.materialGrade ? `${MATERIAL_GRADE_LABELS[job.materialGrade]} 자재` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>

        <span className="job-card__meta">
          {[
            job.desiredStartAt
              ? `${new Date(job.desiredStartAt).toLocaleDateString('ko-KR', { month: 'long' })} 희망`
              : '시기 미정',
            `${ago(job.createdAt)} 등록`,
            `제안 ${job.contactCount}건`,
          ].join(' · ')}
        </span>
      </span>

      <span className="job-card__go">
        <span className="btn btn--primary btn--md">보기</span>
      </span>
    </a>
  );
}

/** 첫 진입 스켈레톤. 필터는 즉시 렌더되어 로딩 중에도 조건을 바꿀 수 있다. */
function JobsSkeleton() {
  return (
    <div className="jobs__list" aria-label="불러오는 중">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="job-card" aria-hidden="true">
          <span className="job-card__media skeleton" />
          <span className="job-card__body" style={{ paddingTop: 4, gap: 8 }}>
            <span className="skeleton" style={{ display: 'block', height: 18, width: '62%' }} />
            <span className="skeleton" style={{ display: 'block', height: 13, width: '45%' }} />
            <span className="skeleton" style={{ display: 'block', height: 13, width: '34%' }} />
          </span>
        </div>
      ))}
    </div>
  );
}
