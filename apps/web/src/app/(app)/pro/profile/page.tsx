'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { PRO_CATEGORY_LIMIT, PRO_INTRO_LIMIT, WORK_CATEGORY_SEEDS } from '@fitter/shared';

import { Avatar } from '../../../../components/ui/Avatar';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Field, FormError } from '../../../../components/form';
import { ApiError, api, imageUrl } from '../../../../lib/api';
import { useSession } from '../../../../lib/session';

interface RegionTree {
  sido: { code: string; name: string; sigungu: { code: string; name: string }[] }[];
}

interface CompletenessItem {
  key: 'IDENTITY' | 'CATEGORIES' | 'SERVICE_AREAS' | 'INTRO' | 'BUSINESS_NUMBER';
  required: boolean;
  done: boolean;
}

interface ProProfile {
  businessName: string;
  intro: string | null;
  careerYears: number;
  businessNumber: string | null;
  isApproved: boolean;
  isDormant: boolean;
  rejectionReason: string | null;
  nickname: string;
  phone: string | null;
  updatedAt: string;
  workCategories: { code: string; nameKo: string }[];
  serviceAreas: { code: string; sigunguName: string }[];
  completeness: { items: CompletenessItem[]; percent: number; requiredMet: boolean };
}

interface MyPortfolio {
  id: string;
  coverThumbKey: string | null;
}

/** 완성도 항목의 화면 라벨. 순서는 서버가 주는 순서를 따른다. */
const ITEM_LABELS: Record<CompletenessItem['key'], string> = {
  IDENTITY: '활동명과 연락처',
  CATEGORIES: '공종 선택',
  SERVICE_AREAS: '활동 지역',
  INTRO: '소개 문구',
  BUSINESS_NUMBER: '사업자등록번호',
};

/**
 * 시공자 프로필 편집 (P-01).
 *
 * **온보딩의 마지막 관문이다.** 여기를 통과하지 못한 시공자는 활동명이 비어 있어
 * `/pros` 목록에 뜨지 않고, 공종·지역이 없어 `/jobs` 에 맞는 의뢰도 오지 않는다.
 * 화면이 없던 동안 신규 시공자는 등록을 끝낼 방법이 없었다.
 *
 * 경로가 `/pro/profile` 인 이유는 **서버가 이미 그 주소를 약속하고 있기 때문**이다 —
 * `POST /me/profile` 이 PRO 에게 `next: '/pro/profile'` 을 돌려준다.
 *
 * 시안: design/P-01 프로필 편집.dc.html (7상태)
 */
export default function ProProfilePage() {
  const router = useRouter();
  const { user, loading, authFetch } = useSession();

  const [profile, setProfile] = useState<ProProfile | null>(null);
  const [regions, setRegions] = useState<RegionTree | null>(null);
  const [shots, setShots] = useState<MyPortfolio[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  /* 폼 상태. 로드된 프로필을 원본으로 두고 여기서 갈라진다. */
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [careerYears, setCareerYears] = useState('');
  const [intro, setIntro] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [openToWork, setOpenToWork] = useState(true);

  const [saving, setSaving] = useState(false);
  /**
   * 저장 완료 토스트. `wasOnboarding` 은 **저장을 누른 시점의** 신규 여부다.
   *
   * 저장하면 `profile` 이 갈리고 `isNew` 가 false 가 되므로, 그 값으로 토스트를 그리면
   * **버튼이 약속한 곳과 다른 데를 가리킨다** — "저장하고 의뢰 보러 가기"를 눌렀는데
   * 토스트가 "포트폴리오 올리러 가기"를 내밀었다. 브라우저에서 그렇게 됐다.
   */
  const [saved, setSaved] = useState<{ wasOnboarding: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* 서버가 400 으로 지목한 필드. 시안의 `검증 오류` 상태가 이걸 쓴다. */
  const [invalidFields, setInvalidFields] = useState<string[]>([]);

  const ready = !loading && !!user;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/pro/profile')}`);
      return;
    }
    if (user.profileType !== 'PRO') {
      /* 고객이 올 화면이 아니다. 자기 홈으로 돌려보낸다. */
      router.replace('/requests/mine');
    }
  }, [loading, user, router]);

  /** 프로필과 지역 트리를 채운다. 폼 초기값은 서버 값이 유일한 출처다. */
  const load = useCallback(async () => {
    const [next, tree] = await Promise.all([
      authFetch<ProProfile>('/me/pro-profile'),
      api<RegionTree>('/regions'),
    ]);
    setProfile(next);
    setRegions(tree);
    setBusinessName(next.businessName);
    setPhone(next.phone ?? '');
    setCareerYears(next.careerYears ? String(next.careerYears) : '');
    setIntro(next.intro ?? '');
    setBusinessNumber(next.businessNumber ?? '');
    setCategories(next.workCategories.map((c) => c.code));
    setAreas(next.serviceAreas.map((a) => a.code));
    setOpenToWork(!next.isDormant);
  }, [authFetch]);

  useEffect(() => {
    if (!ready || user?.profileType !== 'PRO') return;
    let alive = true;
    void load().catch((err: unknown) => {
      if (!alive) return;
      setLoadError(err instanceof ApiError ? err.message : '프로필을 불러오지 못했습니다.');
    });
    return () => {
      alive = false;
    };
  }, [ready, user?.profileType, load]);

  /* 미리보기 카드의 사진 3장. 없으면 자리만 비운다 — 줄무늬를 채우지 않는다. */
  useEffect(() => {
    if (!ready || user?.profileType !== 'PRO') return;
    let alive = true;
    void authFetch<{ items: MyPortfolio[] }>('/me/portfolios?limit=3')
      .then((res) => {
        if (alive) setShots(res.items.slice(0, 3));
      })
      .catch(() => {
        /* 미리보기용이다. 실패해도 폼은 쓸 수 있어야 한다. */
      });
    return () => {
      alive = false;
    };
  }, [ready, user?.profileType, authFetch]);

  const sigungu = useMemo(
    () => regions?.sido.flatMap((s) => s.sigungu.map((g) => ({ ...g, sido: s.name }))) ?? [],
    [regions],
  );

  const toggle = (list: string[], code: string, limit?: number) => {
    if (list.includes(code)) return list.filter((c) => c !== code);
    if (limit && list.length >= limit) return list;
    return [...list, code];
  };

  /**
   * 저장하지 않은 변경 개수.
   *
   * 시안은 "저장하지 않은 변경 3건"이라고 적어뒀다. 실제로 세면 되는 값이라 센다 —
   * 고정 문자열로 두면 항상 3건이라고 거짓말하는 화면이 된다.
   */
  const dirtyCount = useMemo(() => {
    if (!profile) return 0;
    const same = [
      businessName.trim() === profile.businessName,
      phone.replace(/[\s-]/g, '') === (profile.phone ?? ''),
      (careerYears === '' ? 0 : Number(careerYears)) === profile.careerYears,
      intro.trim() === (profile.intro ?? ''),
      businessNumber.trim() === (profile.businessNumber ?? ''),
      categories.join(',') === profile.workCategories.map((c) => c.code).join(','),
      areas.join(',') === profile.serviceAreas.map((a) => a.code).join(','),
      openToWork === !profile.isDormant,
    ];
    return same.filter((s) => !s).length;
  }, [
    profile,
    businessName,
    phone,
    careerYears,
    intro,
    businessNumber,
    categories,
    areas,
    openToWork,
  ]);

  /* 필수 셋. 도메인의 requiredMet 과 같은 규칙이지만 여기선 저장 전 입력값을 본다. */
  const requiredMet = businessName.trim().length > 0 && categories.length > 0 && areas.length > 0;
  const isNew = !!profile && profile.businessName.trim() === '';

  async function save() {
    if (!profile || saving) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    setInvalidFields([]);

    try {
      /*
       * 연락처가 먼저다. 완성도 계산이 서버에서 `User.phone` 을 읽으므로
       * 프로필을 먼저 저장하면 방금 입력한 번호가 반영되지 않은 퍼센트가 나온다.
       *
       * 바뀌지 않았으면 부르지 않는다 — `PATCH /me` 는 빈 본문을 거부하고,
       * 무엇보다 두 요청 중 하나만 성공하는 창을 좁혀야 한다.
       */
      const nextPhone = phone.replace(/[\s-]/g, '');
      if (nextPhone !== (profile.phone ?? '')) {
        await authFetch('/me', {
          method: 'PATCH',
          body: JSON.stringify({ phone: nextPhone }),
        });
      }

      const next = await authFetch<ProProfile>('/me/pro-profile', {
        method: 'PUT',
        body: JSON.stringify({
          businessName: businessName.trim(),
          intro: intro.trim() || undefined,
          careerYears: careerYears === '' ? 0 : Number(careerYears),
          businessNumber: businessNumber.trim() || undefined,
          workCategoryCodes: categories,
          regionCodes: areas,
          isDormant: !openToWork,
        }),
      });

      /* 버튼을 누른 시점의 신규 여부를 기억한다. setProfile 뒤에는 알 수 없다. */
      const wasOnboarding = isNew;
      setProfile(next);
      setSaved({ wasOnboarding });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        /*
         * 서버는 어긋난 필드를 `details.issues[].path` 로 준다(zod 검증 파이프의 모양이다).
         * `details.field` 로 읽으면 항상 undefined 라서 **검증 오류 상태가 영원히 안 뜬다** —
         * 400 을 실제로 받아보고 알았다. 화면은 서버가 지목한 필드만 빨갛게 만든다.
         */
        const issues = (err.details as { issues?: { path?: string }[] } | undefined)?.issues;
        const fields = (issues ?? []).map((i) => i.path).filter((p): p is string => !!p);
        if (fields.length > 0) setInvalidFields(fields);
      } else {
        setError('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <main className="shell prof">
        <div className="empty">
          <strong className="empty__title">프로필을 불러오지 못했습니다</strong>
          <p className="empty__body">{loadError}</p>
          <Button onClick={() => void load()}>다시 시도</Button>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="shell prof" aria-busy="true">
        <div className="prof__head">
          <span className="skeleton" style={{ width: '340px', height: '36px' }} />
          <span className="skeleton" style={{ width: '100%', maxWidth: '560px', height: '20px' }} />
        </div>
        <div className="prof__form">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="skeleton"
              style={{ height: '180px', borderRadius: 'var(--radius-lg)' }}
            />
          ))}
        </div>
      </main>
    );
  }

  /*
   * 상태 칩과 배너. 시안의 7상태가 여기서 갈린다.
   *
   * `pending`·`rejected` 는 실제로 `isApproved` + `rejectionReason` 이 만든 상태다.
   * 서류 업로드가 없어도 이 둘은 진짜다 — 관리자가 사업자등록번호를 보고 판단한다.
   */
  /*
   * **순서가 중요하다. `미완성` 이 `승인 시공자` 보다 앞이다.**
   *
   * 역할을 고르면 `ProProfile` 행이 자동 생성되고, 관리자 승인 큐는 활동명이 비었는지
   * 보지 않으므로 **활동명이 빈 채로 승인된 계정이 실제로 존재한다.**
   * `isApproved` 를 먼저 보면 그 계정에 "승인 시공자"라고 붙는다 —
   * 완성도 0%에 배지가 달린 화면을 브라우저에서 직접 봤다.
   *
   * 승인은 "관리자가 확인했다"는 뜻이고 프로필이 찼다는 뜻이 아니다. 시안도 같은 순서다.
   */
  const statusTone = profile.rejectionReason
    ? 'danger'
    : isNew
      ? 'muted'
      : profile.isApproved
        ? 'verified'
        : 'warning';
  const statusLabel = profile.rejectionReason
    ? '승인 반려'
    : isNew
      ? '미완성'
      : profile.isApproved
        ? '승인 시공자'
        : '심사 대기';

  const banner = profile.rejectionReason
    ? {
        tone: 'danger' as const,
        title: '승인이 반려되었습니다',
        body: profile.rejectionReason,
      }
    : !profile.isApproved && !isNew
      ? {
          tone: 'warning' as const,
          title: '승인 심사 중입니다',
          body: '심사 중에도 포트폴리오 등록과 제안은 할 수 있습니다. 승인되면 사례가 갤러리에 공개되고 시공자 목록에도 뜹니다.',
        }
      : isNew
        ? {
            tone: 'info' as const,
            title: '프로필을 채워야 의뢰를 받을 수 있습니다',
            body: '활동명·공종·활동 지역까지만 채우면 바로 의뢰 목록이 열립니다. 소개와 사업자등록번호는 나중에 추가해도 됩니다.',
          }
        : null;

  const saveHint = saving
    ? '저장 중입니다. 창을 닫지 마세요.'
    : isNew
      ? `필수 항목 ${3}개를 채우면 저장할 수 있습니다.`
      : `마지막 저장 ${new Date(profile.updatedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} · 저장 즉시 공개 프로필에 반영됩니다.`;

  const areaNames = areas
    .map((code) => sigungu.find((g) => g.code === code)?.name)
    .filter(Boolean)
    .join('·');
  const categoryNames = categories
    .map((code) => WORK_CATEGORY_SEEDS.find((c) => c.code === code)?.nameKo)
    .filter(Boolean)
    .join('·');

  return (
    <main className="shell prof">
      {isNew && (
        <div className="prof__progress">
          <div className="prof__progress-row">
            <span className="prof__progress-label">온보딩 3단계 중 3</span>
            <span className="prof__progress-pct">{profile.completeness.percent}%</span>
          </div>
          <div className="prof__bar">
            <div className="prof__bar-fill" style={{ width: `${profile.completeness.percent}%` }} />
          </div>
        </div>
      )}

      <div className="prof__head">
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}
        >
          <h1 className="prof__h1">{isNew ? '시공자 프로필을 만들어 주세요' : '프로필 편집'}</h1>
          <Badge tone={statusTone}>{statusLabel}</Badge>
        </div>
        <p className="prof__sub">
          {isNew
            ? '고객은 이 정보만 보고 컨택할지 정합니다. 화려한 소개보다 정확한 공종·지역이 더 많은 의뢰로 이어집니다.'
            : '저장하면 시공자 목록과 프로필 상세에 즉시 반영됩니다.'}
        </p>
      </div>

      {banner && (
        <div className={`prof__banner prof__banner--${banner.tone}`}>
          <strong>{banner.title}</strong>
          <span>{banner.body}</span>
        </div>
      )}

      <div className="split">
        <form
          className="prof__form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <section className="prof-card">
            <strong className="prof-card__title">기본 정보</strong>
            <div className="prof-card__identity">
              <Avatar name={businessName || profile.nickname} size={52} />
              <span className="prof-card__identity-note">
                아바타는 활동명에서 자동으로 만듭니다. 사진 업로드는 아직 없습니다.
              </span>
            </div>
            <div className="prof-card__pair">
              <Field
                label="활동명"
                hint="고객 목록과 제안에 그대로 노출됩니다. 실명 또는 상호를 권장합니다."
                error={
                  invalidFields.includes('businessName') ? '활동명을 입력해 주세요.' : undefined
                }
              >
                <input
                  className={`input${invalidFields.includes('businessName') ? ' input--error' : ''}`}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="예) 김도배 · 성북도배"
                  maxLength={60}
                  required
                />
              </Field>
              <Field
                label="휴대폰 번호"
                hint="컨택이 수락된 고객에게만 공개됩니다."
                error={
                  invalidFields.includes('phone') ? '숫자 10~11자리를 입력해 주세요.' : undefined
                }
              >
                <input
                  className={`input${invalidFields.includes('phone') ? ' input--error' : ''}`}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="숫자만 입력 · 하이픈은 자동으로 지웁니다"
                  inputMode="numeric"
                  autoComplete="tel"
                />
              </Field>
            </div>
          </section>

          <section className="prof-card">
            <span className="prof-card__titled">
              <strong className="prof-card__title">전문 분야와 활동 지역</strong>
              <span className="prof-card__note">
                여기서 고른 조합에 맞는 의뢰만 <Link href="/jobs">받은 의뢰</Link>에 노출됩니다.
              </span>
            </span>

            <div className="prof-card__group">
              <span className="prof-card__group-label">공종 (최대 {PRO_CATEGORY_LIMIT}개)</span>
              <div className="chip-row chip-row--wrap">
                {WORK_CATEGORY_SEEDS.map((c) => {
                  const active = categories.includes(c.code);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      className="chip chip--lg"
                      aria-pressed={active}
                      /* 상한에 닿으면 새로 고르는 것만 막는다. 해제는 언제나 된다. */
                      disabled={!active && categories.length >= PRO_CATEGORY_LIMIT}
                      onClick={() =>
                        setCategories((cur) => toggle(cur, c.code, PRO_CATEGORY_LIMIT))
                      }
                    >
                      {c.nameKo}
                    </button>
                  );
                })}
              </div>
              {categories.length === 0 && invalidFields.length > 0 && (
                <span className="prof-card__error">공종을 1개 이상 선택해 주세요.</span>
              )}
            </div>

            <div className="prof-card__group">
              <span className="prof-card__group-label">활동 지역</span>
              <div className="chip-row chip-row--wrap">
                {sigungu.map((g) => {
                  const active = areas.includes(g.code);
                  return (
                    <button
                      key={g.code}
                      type="button"
                      className="chip chip--lg"
                      aria-pressed={active}
                      onClick={() => setAreas((cur) => toggle(cur, g.code))}
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="prof-card__narrow">
              <Field label="경력" hint="카드에 “경력 N년”으로 표시됩니다.">
                <input
                  className="input"
                  value={careerYears}
                  onChange={(e) => setCareerYears(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="0"
                  inputMode="numeric"
                  aria-label="경력 연수"
                />
              </Field>
            </div>
          </section>

          <section className="prof-card">
            <strong className="prof-card__title">소개</strong>
            <Field
              label="한 줄 소개와 시공 방식"
              hint={`${intro.length} / ${PRO_INTRO_LIMIT}자 · 광고 문구보다 실제 시공 방식이 더 잘 통합니다.`}
            >
              <textarea
                className="input"
                rows={5}
                value={intro}
                maxLength={PRO_INTRO_LIMIT}
                onChange={(e) => setIntro(e.target.value)}
                placeholder="어떤 현장을 주로 하는지, 어떤 방식으로 일하는지 적어주세요."
              />
            </Field>
          </section>

          <section className="prof-card">
            <span className="prof-card__titled">
              <strong className="prof-card__title">사업자 정보</strong>
              <span className="prof-card__note">
                사업자등록번호를 넣으면 관리자 확인 후 <strong>승인 시공자</strong> 배지가 붙습니다.
                없이도 활동할 수 있지만, 승인 전에는 사례가 갤러리에 공개되지 않습니다.
              </span>
            </span>
            <div className="prof-card__pair">
              <Field
                label="사업자등록번호"
                hint="선택 · 관리자가 승인 심사에서 확인합니다."
                error={
                  invalidFields.includes('businessNumber') ? '자릿수를 확인해 주세요.' : undefined
                }
              >
                <input
                  className={`input${invalidFields.includes('businessNumber') ? ' input--error' : ''}`}
                  value={businessNumber}
                  onChange={(e) => setBusinessNumber(e.target.value)}
                  placeholder="000-00-00000"
                  maxLength={20}
                />
              </Field>
            </div>
          </section>

          <section className="prof-card">
            <strong className="prof-card__title">공개 설정</strong>
            <button
              type="button"
              className="prof-toggle"
              aria-pressed={openToWork}
              onClick={() => setOpenToWork((v) => !v)}
            >
              <span className="prof-toggle__text">
                <strong>지금 일감 받는 중</strong>
                <span>끄면 시공자 목록에서 내려가고 새 제안도 보낼 수 없습니다.</span>
              </span>
              <span className="prof-toggle__track">
                <span className="prof-toggle__knob" />
              </span>
            </button>
          </section>

          <FormError message={error} />

          <div className="prof__save">
            <span className="prof__save-hint">{saveHint}</span>
            <div className="prof__save-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void load()}
                disabled={saving}
              >
                되돌리기
              </Button>
              <Button type="submit" pending={saving} disabled={!requiredMet}>
                {isNew ? '저장하고 의뢰 보러 가기' : '변경 사항 저장'}
              </Button>
            </div>
          </div>
        </form>

        <aside className="split__aside">
          <div className="prof-preview">
            <div className="prof-preview__head">
              <span className="prof-preview__eyebrow">고객에게 보이는 카드</span>
              {/*
                승인만 보면 안 된다. `/pros/:id` 의 공개 조건은 승인 + 비휴면 +
                **활동명이 비어 있지 않음** 셋이다. 활동명 없이 승인된 계정이 실제로 있어서
                승인만 확인하면 404 로 가는 링크가 뜬다.
              */}
              {profile.isApproved && !profile.isDormant && !isNew && user && (
                <Link className="prof-preview__link" href={`/pros/${user.id}`}>
                  공개 프로필 보기
                </Link>
              )}
            </div>
            <div className="prof-preview__body">
              <div className="prof-preview__who">
                <Avatar name={businessName || profile.nickname} size={52} />
                <span className="prof-preview__ident">
                  <span className="prof-preview__name-row">
                    <strong className="prof-preview__name">
                      {businessName || '활동명 미입력'}
                    </strong>
                    {profile.isApproved && !isNew && (
                      <Badge tone="verified" size="xs">
                        승인 시공자
                      </Badge>
                    )}
                  </span>
                  <span className="prof-preview__meta">
                    {categoryNames || '공종 미선택'}
                    {careerYears ? ` · 경력 ${careerYears}년` : ''}
                  </span>
                  <span className="prof-preview__region">{areaNames || '활동 지역 미선택'}</span>
                </span>
              </div>
              <span className="prof-preview__bio">
                {intro || '소개가 비어 있습니다. 고객은 소개가 없는 프로필을 잘 누르지 않습니다.'}
              </span>
              {shots.length > 0 && (
                <div className="prof-preview__shots">
                  {shots.map((s) => {
                    const src = imageUrl(s.coverThumbKey);
                    return (
                      <span key={s.id} className="prof-preview__shot">
                        {src && <img src={src} alt="" />}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="prof-done">
            <div className="prof-done__head">
              <strong>완성도</strong>
              <span className="prof-done__pct">{profile.completeness.percent}%</span>
            </div>
            <div className="prof__bar">
              <div
                className="prof__bar-fill"
                style={{ width: `${profile.completeness.percent}%` }}
              />
            </div>
            {profile.completeness.items.map((item) => (
              <span
                key={item.key}
                className={`prof-done__item${item.done ? ' prof-done__item--done' : ''}`}
              >
                <span className="prof-done__dot" aria-hidden="true">
                  ✓
                </span>
                <span className="prof-done__label">
                  {ITEM_LABELS[item.key]}
                  {item.required && !item.done && <span className="prof-done__req">필수</span>}
                </span>
              </span>
            ))}
          </div>
        </aside>
      </div>

      {/* 모바일 저장 바. 데스크톱은 폼 끝의 `.prof__save` 가 맡는다. */}
      <div className="sticky-cta">
        {dirtyCount > 0 && <span className="prof__dirty">저장하지 않은 변경 {dirtyCount}건</span>}
        <Button
          type="button"
          pending={saving}
          disabled={!requiredMet}
          block
          onClick={() => void save()}
        >
          {isNew ? '저장하고 의뢰 보러 가기' : '변경 사항 저장'}
        </Button>
      </div>

      {saved && (
        <div className="prof-toast" role="status">
          <span>프로필을 저장했습니다</span>
          <Link href={saved.wasOnboarding ? '/jobs' : '/portfolios/new'}>
            {saved.wasOnboarding ? '의뢰 보러 가기' : '포트폴리오 올리러 가기'}
          </Link>
        </div>
      )}
    </main>
  );
}
