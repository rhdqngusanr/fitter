'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  HOUSING_TYPES,
  HOUSING_TYPE_LABELS,
  MATERIAL_GRADES,
  MATERIAL_GRADE_HINTS,
  MATERIAL_GRADE_LABELS,
  MAX_IMAGE_BYTES,
  MAX_PORTFOLIO_IMAGES,
  MAX_PYEONG,
  MIN_PYEONG,
  SQUARE_METERS_PER_PYEONG,
  THUMBNAIL_DETAIL_WIDTH,
  THUMBNAIL_LIST_WIDTH,
  WORK_CATEGORY_SEEDS,
  type HousingType,
  type MaterialGrade,
} from '@fitter/shared';

import { Field, FormError } from '../../../../components/form';
import { ImageUploader, type UploadedImage } from '../../../../components/ImageUploader';
import { Button } from '../../../../components/ui/Button';
import { ApiError, api } from '../../../../lib/api';
import { useSession } from '../../../../lib/session';

interface RegionTree {
  sido: { code: string; name: string; sigungu: { code: string; name: string }[] }[];
}

interface ProProfile {
  businessName: string;
  isApproved: boolean;
}

/**
 * 업로드가 사진에 무슨 짓을 하는지.
 *
 * **시안이 이걸 우측 패널에 상주시킨 이유가 있다.** 시공자는 자기 작업 사진을 올리는
 * 사람이고, 그 사진에는 현장 주소가 EXIF 로 박혀 있다. 그게 지워진다는 걸 모르면
 * 올리기를 망설이거나, 모르고 올렸다가 나중에 알고 화를 낸다.
 *
 * 숫자는 전부 `packages/shared` 정본에서 계산한다 — 한도가 바뀌면 문구가 거짓말이 된다.
 */
const PIPELINE_NOTES = [
  `장당 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB까지, 최대 ${MAX_PORTFOLIO_IMAGES}장.`,
  '올리는 동안 위치 정보(EXIF)를 지웁니다. 현장 주소가 사진에 남지 않습니다.',
  `목록용 ${THUMBNAIL_LIST_WIDTH}px · 상세용 ${THUMBNAIL_DETAIL_WIDTH}px 로 줄여서 씁니다.`,
  '원본은 보관하되 어떤 화면에도 내보내지 않습니다.',
];

/**
 * 포트폴리오 등록 (P-02).
 *
 * 시공자 쪽 입구다. **공개 조건이 두 개**라는 걸 화면이 미리 말해야 한다 —
 * 항목을 공개해도 관리자 승인 전에는 갤러리에 뜨지 않는다.
 * 올리고 나서 안 보이면 사람은 서비스가 고장 났다고 생각하고 떠난다.
 *
 * **시안의 데스크톱은 2단이다** — 본문 + 우측 348px(갤러리 미리보기 · 공개 조건 ·
 * 업로드 처리 방식). 구현은 640px 단일 컬럼이고 우측이 통째로 없었다.
 *
 * 근거: design/P-02 포트폴리오 등록.dc.html · brain/20-도메인/엔티티 - PortfolioItem.md
 */
export default function NewPortfolioPage() {
  const { user, loading, authFetch } = useSession();
  const router = useRouter();

  const [draftId, setDraftId] = useState<string | null>(null);
  const [regions, setRegions] = useState<RegionTree | null>(null);
  const [profile, setProfile] = useState<ProProfile | null>(null);
  /**
   * 시공자 프로필 상태.
   *
   * 셋을 구분해야 한다. `unknown`(아직 못 읽음) · `none`(프로필 자체가 없음) ·
   * `pending`(있지만 미승인) · `approved`. **`none` 과 `pending` 은 다음 할 일이 다르다** —
   * 앞은 프로필을 만들어야 하고 뒤는 기다리면 된다.
   */
  const [proState, setProState] = useState<'unknown' | 'none' | 'pending' | 'approved'>('unknown');
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [images, setImages] = useState<UploadedImage[]>([]);
  const [title, setTitle] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [sido, setSido] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [pyeong, setPyeong] = useState('');
  const [housingType, setHousingType] = useState<HousingType | ''>('');
  const [materialGrade, setMaterialGrade] = useState<MaterialGrade | ''>('');
  const [workDays, setWorkDays] = useState('');
  const [workedAt, setWorkedAt] = useState('');
  const [description, setDescription] = useState('');
  const [costPublic, setCostPublic] = useState(false);
  const [actualCost, setActualCost] = useState('');
  const [consent, setConsent] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/portfolios/new')}`);
      return;
    }
    /* 시공자만 올릴 수 있다. 서버 가드도 같은 규칙이라 여기서는 안내만 한다. */
    if (user.profileType !== 'PRO') router.replace('/');
  }, [loading, user, router]);

  const ready = !loading && user?.profileType === 'PRO';
  useEffect(() => {
    if (!ready || draftId) return;
    let alive = true;
    void (async () => {
      try {
        const [draft, tree] = await Promise.all([
          authFetch<{ id: string }>('/portfolios', { method: 'POST' }),
          api<RegionTree>('/regions'),
        ]);
        if (!alive) return;
        setDraftId(draft.id);
        setRegions(tree);
      } catch (err) {
        if (alive) setError(err instanceof ApiError ? err.message : '시작하지 못했습니다.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [ready, draftId, authFetch]);

  /*
   * 승인 상태는 **별도 effect 여야 한다.**
   *
   * 처음에는 위 effect 안에 같이 뒀는데, 초안 생성이 끝나면 `draftId` 가 바뀌어 effect 가
   * 다시 돌고 그 정리 함수가 `alive = false` 를 만든다. 그 시점에 프로필 요청이 아직
   * 날아오는 중이면 응답이 통째로 버려져서 상태가 영원히 `unknown` 에 머문다.
   * 브라우저에서 실제로 그렇게 됐다 — 공개할 수 없는 계정에 공개 버튼이 남아 있었다.
   *
   * 프로필이 아예 없으면 404 다(방금 시공자를 고른 계정). **프로필이 없으면 승인도 있을
   * 수 없으므로 공개도 불가능하다.** 404 를 조용히 삼키면 화면이 "공개할 수 있다"고
   * 착각하고, 사용자는 버튼을 누른 뒤에야 안다.
   */
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    void authFetch<ProProfile>('/me/pro-profile')
      .then((p) => {
        if (!alive) return;
        setProfile(p);
        setProState(p.isApproved ? 'approved' : 'pending');
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setProState(err instanceof ApiError && err.status === 404 ? 'none' : 'unknown');
      });
    return () => {
      alive = false;
    };
  }, [ready, authFetch]);

  const pyeongNum = Number(pyeong);
  const validPyeong = pyeong !== '' && Number.isFinite(pyeongNum) && pyeongNum > 0;
  const sigungu = regions?.sido.find((s) => s.code === sido)?.sigungu ?? [];
  const regionName = sigungu.find((g) => g.code === regionCode)?.name ?? '';
  const categoryNames = WORK_CATEGORY_SEEDS.filter((c) => categories.includes(c.code)).map(
    (c) => c.nameKo,
  );

  /** 올린 내용을 서버 모양으로 모은다. 저장과 공개가 같은 값을 쓴다. */
  const payload = useCallback(
    () => ({
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      areaPyeong: validPyeong ? pyeongNum : undefined,
      housingType: housingType || undefined,
      regionCode: regionCode || undefined,
      workCategoryCodes: categories,
      materialGrade: materialGrade || undefined,
      workDays: workDays ? Number(workDays) : undefined,
      workedAt: workedAt || undefined,
      /* 공개하지 않기로 했으면 금액을 아예 보내지 않는다. 서버도 그 조합을 거부한다. */
      isCostPublic: costPublic,
      ...(costPublic && actualCost ? { actualCost: Number(actualCost) } : {}),
    }),
    [
      title,
      description,
      validPyeong,
      pyeongNum,
      housingType,
      regionCode,
      categories,
      materialGrade,
      workDays,
      workedAt,
      costPublic,
      actualCost,
    ],
  );

  /** 본문과 사진 행을 서버에 붙인다. 공개 여부는 부르는 쪽이 정한다. */
  const persist = useCallback(async () => {
    if (!draftId) return;
    await authFetch(`/portfolios/${draftId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload()),
    });
    /* 커버는 AFTER 중 첫 장이다. 목록에서 보고 싶은 건 결과지 철거 직전 모습이 아니다. */
    const coverIndex = Math.max(
      0,
      images.findIndex((i) => i.phase === 'AFTER'),
    );
    for (const [i, img] of images.entries()) {
      await authFetch(`/portfolios/${draftId}/images`, {
        method: 'POST',
        body: JSON.stringify({
          storageKey: img.storageKey,
          phase: img.phase ?? undefined,
          sortOrder: i,
          isCover: i === coverIndex,
        }),
      });
    }
    setSavedAt(new Date());
  }, [draftId, authFetch, payload, images]);

  if (loading || user?.profileType !== 'PRO') return null;

  /* 공개하려면 갖춰야 하는 것. 못 하면 이유를 말한다. */
  const blocked =
    images.length === 0
      ? '사진을 최소 한 장 올려주세요. 고객은 사진을 보고 문의합니다.'
      : !title.trim()
        ? '작업 제목을 적어주세요.'
        : categories.length === 0
          ? '공종을 하나 이상 골라주세요.'
          : !regionCode
            ? '시공 지역을 골라주세요.'
            : !consent
              ? '본인 시공 사진임을 확인해 주세요.'
              : costPublic && !actualCost
                ? '공개할 비용을 적어주세요.'
                : null;

  async function publish() {
    if (blocked) {
      setTried(true);
      return;
    }
    setError(null);
    setPending(true);
    try {
      await persist();
      await authFetch(`/portfolios/${draftId}/publish`, { method: 'POST' });
      router.push('/portfolios/mine');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '등록하지 못했습니다.');
      setPending(false);
    }
  }

  /**
   * 비공개로 저장.
   *
   * **시안이 이 버튼을 왼쪽에 따로 둔 이유가 있다.** 사진 15장을 올리다 말면
   * 그 업로드가 전부 헛일이 된다. DRAFT 로 남겨두면 나중에 이어서 할 수 있다.
   * 공개하지 않으므로 검증도 걸지 않는다 — 미완성이 DRAFT 의 정의다.
   */
  async function saveDraft() {
    setError(null);
    setPending(true);
    try {
      await persist();
      router.push('/portfolios/mine');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '저장하지 못했습니다.');
      setPending(false);
    }
  }

  const showBlocked = tried && !!blocked;
  const full = images.length >= MAX_PORTFOLIO_IMAGES;
  /*
   * **미승인 시공자는 공개 자체가 막힌다**(서버가 403). 그러면 공개 버튼은 누를 때마다
   * 실패하는 버튼이므로 두지 않고, 비공개 저장을 주 행동으로 올린다.
   * 아직 못 읽었을 때(`unknown`)는 감추지 않는다 — 모르는 걸 단정하지 않는다.
   */
  const canPublish = proState === 'approved' || proState === 'unknown';

  return (
    <>
      <div className="shell">
        <div className="wizard__topbar">
          <span className="wizard__topbar-title">포트폴리오 등록</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {savedAt && (
              <span className="wizard__saved">
                {savedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}{' '}
                임시저장됨
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="upload">
        <main className="upload__main">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h1 className="upload__h1">시공 사진을 올려주세요</h1>
            <p className="upload__lead">
              사진이 곧 이력서입니다. 시공 전·후가 함께 있으면 문의가 눈에 띄게 늘어납니다. 최대{' '}
              {MAX_PORTFOLIO_IMAGES}장.
            </p>
          </div>

          <FormError message={error} />

          {/* ── 사진 ─────────────────────────────────── */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div className="upload__section-head">
              <span className="upload__section-title">사진</span>
              <span className={`upload__count${full ? ' upload__count--full' : ''}`}>
                {images.length} / {MAX_PORTFOLIO_IMAGES}
              </span>
            </div>

            {draftId ? (
              <ImageUploader
                mode="portfolio"
                images={images}
                max={MAX_PORTFOLIO_IMAGES}
                onChange={setImages}
                authFetch={authFetch}
              />
            ) : (
              <span className="upload__note">준비 중…</span>
            )}

            {/*
              시안이 사진 영역 바로 아래 둔 문장이다. 현장 주소가 사진에 남지 않는다는 건
              시공자가 올리기를 망설이는 이유를 정확히 짚는다.
            */}
            <span className="upload__note">
              올리는 동안 자동으로 크기를 줄이고 <strong>위치 정보(EXIF)를 지웁니다.</strong> 현장
              주소가 사진에 남지 않습니다.
            </span>
          </section>

          {/* ── 정보 ─────────────────────────────────── */}
          <section className="upload__grid3">
            <Field label="작업 제목">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="예) 화이트 실크 + 우드 몰딩"
                className="input"
              />
            </Field>

            {/* 확장 규약 3조 — 시도→시군구 2단계. 주소 원문 칸은 없다. */}
            <Field label="시공 지역">
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <select
                  value={sido}
                  onChange={(e) => {
                    setSido(e.target.value);
                    setRegionCode('');
                  }}
                  className="input"
                  aria-label="시·도"
                >
                  <option value="">시·도</option>
                  {regions?.sido.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={regionCode}
                  onChange={(e) => setRegionCode(e.target.value)}
                  disabled={!sido}
                  className="input"
                  aria-label="시·군·구"
                >
                  <option value="">시·군·구</option>
                  {sigungu.map((g) => (
                    <option key={g.code} value={g.code}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </Field>

            {/*
              확장 규약 1조 — 숫자다.

              플레이스홀더에 단위를 넣지 않는다. `24평` 이라고 써두면 숫자 칸인데 단위까지
              칠 수 있는 것처럼 보인다 — 실제로는 못 친다. 단위는 라벨과 힌트가 말한다.
              (`pnpm qc` 가 이걸 자유 텍스트 평수로 잡아서 알았다.)
            */}
            <Field
              label="평형(평) · 기간(일)"
              hint={
                validPyeong
                  ? `약 ${(pyeongNum * SQUARE_METERS_PER_PYEONG).toFixed(1)}㎡`
                  : '숫자만 입력하세요'
              }
            >
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_PYEONG}
                  max={MAX_PYEONG}
                  value={pyeong}
                  onChange={(e) => setPyeong(e.target.value)}
                  placeholder="24"
                  className="input"
                  aria-label="평형"
                />
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={workDays}
                  onChange={(e) => setWorkDays(e.target.value)}
                  placeholder="2"
                  className="input"
                  aria-label="공사 일수"
                />
              </div>
            </Field>
          </section>

          <section className="upload__fields">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="wizard__group-label wizard__group-label--sm">공종</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {WORK_CATEGORY_SEEDS.map((c) => {
                  const on = categories.includes(c.code);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      className="chip chip--lg"
                      aria-pressed={on}
                      onClick={() =>
                        setCategories((prev) =>
                          prev.includes(c.code)
                            ? prev.filter((x) => x !== c.code)
                            : [...prev, c.code],
                        )
                      }
                    >
                      {c.nameKo}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="wizard__group-label wizard__group-label--sm">자재 등급</span>
              <div className="grade-row" role="group" aria-label="자재 등급">
                {MATERIAL_GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className="grade grade--sm"
                    aria-pressed={materialGrade === g}
                    onClick={() => setMaterialGrade(materialGrade === g ? '' : g)}
                  >
                    <span className="grade__label">{MATERIAL_GRADE_LABELS[g]}</span>
                    <span className="grade__hint">{MATERIAL_GRADE_HINTS[g]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <Field label="주거 형태">
                  <select
                    value={housingType}
                    onChange={(e) => setHousingType(e.target.value as HousingType)}
                    className="input"
                  >
                    <option value="">선택</option>
                    {HOUSING_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {HOUSING_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <Field label="시공 시기">
                  <input
                    type="date"
                    value={workedAt}
                    onChange={(e) => setWorkedAt(e.target.value)}
                    className="input"
                  />
                </Field>
              </div>
            </div>

            {/*
              비용 공개는 강제할 수 없어서 유인으로 접근한다. 공개하면 뱃지를 준다.
              체크를 풀면 금액 칸 자체가 사라진다 — 안 쓸 값을 화면에 남겨두지 않는다.
            */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label className="upload__consent" style={{ background: 'var(--color-bg)' }}>
                <input
                  type="checkbox"
                  checked={costPublic}
                  onChange={(e) => setCostPublic(e.target.checked)}
                />
                <span>
                  실제 시공 비용을 공개합니다. 공개하면 카드에 <strong>비용 공개</strong> 표시가
                  붙습니다 — 고객이 제일 궁금해하는 정보입니다.
                </span>
              </label>
              {costPublic && (
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={actualCost}
                  onChange={(e) => setActualCost(e.target.value)}
                  placeholder="총 비용 (원)"
                  className="input"
                  style={{ maxWidth: 660 }}
                  aria-label="총 비용"
                />
              )}
            </div>

            <div style={{ maxWidth: 660 }}>
              <Field label="작업 설명 (선택)">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="예) 거주 중 시공. 실크 벽지 전체, 몰딩은 기존 유지. 이틀에 마감."
                  className="input"
                />
              </Field>
            </div>

            {/*
              **포트폴리오에는 사진별 출처가 없다.** 시공자 본인 작업물을 전제하기 때문이다.
              그래서 이 체크가 유일한 관문이고, 체크 없이는 공개할 수 없다.
            */}
            <label
              className={`upload__consent${showBlocked && !consent ? ' upload__consent--error' : ''}`}
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                본인이 시공하고 직접 촬영한 사진입니다. 타인의 시공 사진을 올리면 계정이 정지될 수
                있습니다.
              </span>
            </label>
          </section>

          {/* 우측 패널이 접히는 폭에서도 공개 조건은 보여야 한다. 미리보기는 접어도 이건 아니다. */}
          <div className="upload__gate upload__gate--inline">
            <PublishGate state={proState} />
          </div>

          <div className="upload__foot">
            {canPublish ? (
              <Button
                variant="secondary"
                size="lg"
                disabled={pending}
                onClick={() => void saveDraft()}
              >
                비공개로 저장
              </Button>
            ) : (
              <span className="upload__note">승인이 끝나면 여기서 공개할 수 있습니다.</span>
            )}
            <div className="upload__foot-right">
              {showBlocked && (
                <span role="alert" className="upload__blocked">
                  {blocked}
                </span>
              )}
              <Button
                variant="primary"
                size="lg"
                pending={pending}
                disabled={!draftId}
                onClick={() => void (canPublish ? publish() : saveDraft())}
              >
                {canPublish ? '사례 공개하기' : '비공개로 저장'}
              </Button>
            </div>
          </div>
        </main>

        {/* ── 우측: 결과 미리보기 ─────────────────────── */}
        <aside className="upload__aside" aria-label="올리면 이렇게 보입니다">
          <span className="upload__aside-title">갤러리에 이렇게 보입니다</span>
          <div className="preview-card">
            <div className="preview-card__media">
              {images[0] && <img src={images[0].previewUrl} alt="" />}
              {categoryNames[0] && <span className="card-photo__tag">{categoryNames[0]}</span>}
              {images.length > 1 && <span className="card-photo__count">{images.length}장</span>}
            </div>
            <div className="preview-card__body">
              <strong className="preview-card__title">{title.trim() || '작업 제목'}</strong>
              <span className="preview-card__meta">
                {[
                  [regionName, validPyeong ? `${pyeongNum}평` : null].filter(Boolean).join(' '),
                  profile?.businessName,
                ]
                  .filter(Boolean)
                  .join(' · ') || '지역과 평형을 넣으면 여기 보입니다'}
              </span>
            </div>
          </div>

          <div className="upload__aside-block">
            <span className="upload__aside-heading">공개 조건</span>
            <div className="upload__gate">
              <PublishGate state={proState} />
            </div>
          </div>

          <div className="upload__aside-block">
            <span className="upload__aside-heading">업로드 처리 방식</span>
            {PIPELINE_NOTES.map((note) => (
              <span key={note} className="upload__bullet">
                <span className="upload__aside-note">{note}</span>
              </span>
            ))}
          </div>
        </aside>
      </div>

      {/* ── 모바일 하단 고정 ───────────────────────── */}
      <div className="shell">
        <div className="sticky-cta">
          {showBlocked && (
            <span
              role="alert"
              className="upload__blocked"
              style={{ display: 'block', marginBottom: 'var(--space-2)' }}
            >
              {blocked}
            </span>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {canPublish && (
              <Button
                variant="secondary"
                size="lg"
                disabled={pending}
                onClick={() => void saveDraft()}
              >
                비공개
              </Button>
            )}
            <Button
              variant="primary"
              size="lg"
              block
              pending={pending}
              disabled={!draftId}
              onClick={() => void (canPublish ? publish() : saveDraft())}
            >
              {canPublish ? '사례 공개하기' : '비공개로 저장'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * 승인 전에는 공개 자체가 안 된다.
 *
 * **화면이 서버보다 무른 말을 하고 있었다.** 처음에는 "공개해도 승인 전에는 갤러리에
 * 안 뜬다"고 썼는데, 실제로 눌러보니 서버가 `관리자 승인 후에 이용할 수 있습니다` 로
 * **공개 자체를 막는다**(`POST /portfolios/:id/publish` 는 승인된 시공자 전용이다).
 *
 * 화면이 서버와 다른 말을 하면 사용자는 버튼을 누르고 나서야 진실을 안다.
 * 그래서 문구도 고치고 버튼도 바꿨다 — 미승인 계정에는 공개 버튼을 아예 두지 않는다.
 * 누를 수 없는 버튼을 보여줄 이유가 없다.
 */
function PublishGate({ state }: { state: 'unknown' | 'none' | 'pending' | 'approved' }) {
  if (state === 'approved') {
    return (
      <>
        <span className="upload__gate-title">공개하면 바로 갤러리에 뜹니다</span>
        <span className="upload__gate-body">
          사업자 승인이 끝난 계정입니다. 공개한 사례는 곧바로 검색과 갤러리에 노출됩니다.
        </span>
      </>
    );
  }

  /*
   * 프로필이 아예 없는 경우. 방금 시공자를 고른 계정이 여기 온다.
   * **기다린다고 해결되지 않는다** — 승인 심사에 올릴 프로필 자체가 없기 때문이다.
   * 그래서 "기다리세요"가 아니라 "프로필을 먼저 등록하세요"라고 말해야 한다.
   */
  if (state === 'none') {
    return (
      <>
        <span className="upload__gate-title">시공자 프로필을 먼저 등록해 주세요</span>
        <span className="upload__gate-body">
          <strong>
            프로필이 없으면 승인 심사가 시작되지 않고, 승인 전에는 사례를 공개할 수 없습니다.
          </strong>{' '}
          사진은 지금 올려서 비공개로 저장해두면 그대로 남습니다.
        </span>
      </>
    );
  }

  return (
    <>
      <span className="upload__gate-title">승인 전에는 공개할 수 없습니다</span>
      <span className="upload__gate-body">
        사업자 승인이 끝나야 사례를 공개할 수 있습니다. 승인은 보통 1영업일 안에 끝나고,{' '}
        <strong>지금 비공개로 저장해두면 승인 즉시 공개할 수 있습니다.</strong> 사진은 그대로
        남습니다.
      </span>
    </>
  );
}
