'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  HOUSING_TYPES,
  HOUSING_TYPE_LABELS,
  MATERIAL_GRADES,
  MATERIAL_GRADE_HINTS,
  MATERIAL_GRADE_LABELS,
  MAX_PYEONG,
  MAX_REFERENCE_IMAGES,
  MIN_PYEONG,
  SQUARE_METERS_PER_PYEONG,
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

/**
 * 4단계와 각 단계의 안내 문구. **정본은 시안의 `stepMeta` 다.**
 * 좌측 사이드바의 힌트와 본문의 리드가 여기서 함께 나온다 — 두 곳에 따로 쓰면 갈라진다.
 */
const STEPS = [
  {
    title: '사진 올리기',
    hint: '3~10장 권장',
    lead: '마음에 든 사진을 올려주세요. 인테리어 용어는 몰라도 됩니다 — 사진이 곧 요구사항입니다.',
  },
  {
    title: '공종 고르기',
    hint: '복수 선택 가능',
    lead: '어떤 공사가 필요한가요? 확실하지 않으면 비워두세요. 사진을 보고 시공자가 제안합니다.',
  },
  {
    title: '조건 입력',
    hint: '지역 · 평형 · 시기',
    lead: '시공자가 가능 여부를 판단할 최소 정보만 받습니다.',
  },
  {
    title: '확인하고 등록',
    hint: '마지막 단계',
    lead: '이대로 등록하면 조건에 맞는 시공자에게 노출됩니다.',
  },
] as const;

/**
 * 희망 시기.
 *
 * 시안은 날짜 피커 대신 칩을 준다. 고객은 "8월 중순쯤"으로 생각하지
 * 캘린더에서 날짜를 짚지 않는다. **상대 기간으로 바꾼 이유**는 시안의 "8월 초" 같은
 * 절대 표현이 시간이 지나면 과거가 되기 때문이다 — 그 결정은 시안 대조 결과 노트에 있다.
 */
const TIMINGS = [
  { key: '2w', label: '2주 이내', days: 14 },
  { key: '1m', label: '1개월 이내', days: 30 },
  { key: '3m', label: '3개월 이내', days: 90 },
  { key: 'none', label: '미정', days: null },
] as const;

/**
 * 의뢰 등록 (C-01). **가장 중요한 화면이다.**
 *
 * 첫 화면이 폼이 아니라 사진 자리다 — 3초 안에 "사진을 올리면 그게 의뢰"라는 걸 알게 한다.
 * 한 페이지에 다 몰아넣으면 스크롤이 길어져서 첫 화면이 폼처럼 보인다. 그래서 4단계다.
 *
 * **시안의 데스크톱은 3단이다** — 좌측 스텝 사이드바 · 본문 · 우측 "시공자에게는 이렇게
 * 보입니다". 우측 패널이 마지막 단계로 미룰 수 없는 이유는, 이 화면이 막아야 하는 사고가
 * "무엇을 공개하는지 모르는 채로 등록 버튼을 누르는 것"이기 때문이다.
 *
 * 확장 규약을 화면에서 지키는 것도 이 폼의 존재 이유다 —
 * 평수는 숫자 입력, 지역은 시도→시군구 2단계, 공종은 코드 테이블, 나머지는 enum.
 * 자유 텍스트로 받는 순간 2차 가격 기능의 데이터원이 통째로 망가진다.
 *
 * 근거: design/C-01 의뢰 등록.dc.html · brain/20-도메인/확장 규약.md
 */
export default function NewRequestPage() {
  const { user, loading, authFetch } = useSession();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [regions, setRegions] = useState<RegionTree | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [images, setImages] = useState<UploadedImage[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [sido, setSido] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [pyeong, setPyeong] = useState('');
  const [housingType, setHousingType] = useState<HousingType | ''>('');
  const [materialGrade, setMaterialGrade] = useState<MaterialGrade | ''>('');
  const [timing, setTiming] = useState<(typeof TIMINGS)[number]['key']>('none');
  const [description, setDescription] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /** 다음을 눌렀는데 막힌 경우. 누르기 전에는 빨간 글씨를 띄우지 않는다. */
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/requests/new')}`);
      return;
    }
    if (!user.profileType) {
      router.replace(`/onboarding?next=${encodeURIComponent('/requests/new')}`);
    }
  }, [loading, user, router]);

  /*
   * 사진을 붙이려면 의뢰 행이 먼저 있어야 한다(사진은 의뢰에 매달린다).
   * 그래서 화면에 들어오는 순간 DRAFT 를 만든다. 공개는 마지막 단계에서 따로 한다.
   */
  const ready = !loading && !!user?.profileType;
  useEffect(() => {
    if (!ready || draftId) return;
    let alive = true;
    void (async () => {
      try {
        const [draft, tree] = await Promise.all([
          authFetch<{ id: string }>('/reference-requests', { method: 'POST' }),
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

  const sigungu = regions?.sido.find((s) => s.code === sido)?.sigungu ?? [];
  const regionName = sigungu.find((g) => g.code === regionCode)?.name ?? '';
  const pyeongNum = Number(pyeong);
  const validPyeong = pyeong !== '' && Number.isFinite(pyeongNum) && pyeongNum > 0;
  const categoryNames = WORK_CATEGORY_SEEDS.filter((c) => categories.includes(c.code)).map(
    (c) => c.nameKo,
  );

  /*
   * **제목은 묻지 않고 만든다.**
   *
   * 고객은 의뢰 제목을 어떻게 써야 할지 모른다. 빈 칸을 주면 "도배요"라고 쓰거나
   * 아예 비운다. 지역·평수·공종을 조합하면 시공자가 목록에서 훑기에도 형식이 일정하다.
   */
  const title = useMemo(() => {
    const parts = [regionName, validPyeong ? `${pyeongNum}평` : '', categoryNames.join('+')].filter(
      Boolean,
    );
    return parts.join(' ') || '새 의뢰';
  }, [regionName, validPyeong, pyeongNum, categoryNames]);

  /** 서버에 보낼 값으로 모은다. 스텝을 넘길 때마다 이걸 그대로 저장한다. */
  const payload = useCallback(() => {
    const chosen = TIMINGS.find((t) => t.key === timing);
    const body: Record<string, unknown> = {
      title,
      workCategoryCodes: categories,
      description: description.trim() || undefined,
      regionCode: regionCode || undefined,
      areaPyeong: validPyeong ? pyeongNum : undefined,
      housingType: housingType || undefined,
      materialGrade: materialGrade || undefined,
    };
    /* 희망 시기는 칩에서 날짜로 바꾼다. "미정"이면 아예 안 보낸다. */
    if (chosen?.days) {
      const end = new Date();
      end.setDate(end.getDate() + chosen.days);
      body.desiredStartAt = new Date().toISOString().slice(0, 10);
      body.desiredEndAt = end.toISOString().slice(0, 10);
    }
    return body;
  }, [
    title,
    categories,
    description,
    regionCode,
    validPyeong,
    pyeongNum,
    housingType,
    materialGrade,
    timing,
  ]);

  /** 스텝을 넘길 때마다 임시저장한다. 브라우저를 닫아도 여기까지는 남는다. */
  const save = useCallback(async () => {
    if (!draftId) return;
    await authFetch(`/reference-requests/${draftId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload()),
    });
    setSavedAt(new Date());
  }, [draftId, authFetch, payload]);

  if (loading || !user?.profileType) return null;

  /* 각 단계에서 다음으로 넘어갈 수 있는 조건. 못 넘어가면 이유를 말한다. */
  const blocked =
    step === 0
      ? images.length === 0
        ? '사진을 최소 한 장 올려주세요.'
        : images.find((i) => i.sourceType === 'EXTERNAL' && !i.sourceUrl.trim())
          ? '남의 사진에는 원본 주소가 필요합니다.'
          : null
      : step === 1
        ? categories.length === 0
          ? '공종을 하나 이상 골라주세요.'
          : null
        : step === 2
          ? !regionCode
            ? '시공 지역을 골라주세요.'
            : !validPyeong
              ? '평형을 입력해 주세요.'
              : null
          : null;

  async function next() {
    if (blocked) {
      setTried(true);
      return;
    }
    setError(null);
    setTried(false);
    setPending(true);
    try {
      await save();
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '저장하지 못했습니다.');
    } finally {
      setPending(false);
    }
  }

  async function submit() {
    if (!draftId) return;
    setError(null);
    setPending(true);
    try {
      await save();
      /* 사진 행은 공개 직전에 붙인다. 중간에 나가면 고아 파일은 정리 배치가 치운다. */
      for (const [i, img] of images.entries()) {
        await authFetch(`/reference-requests/${draftId}/images`, {
          method: 'POST',
          body: JSON.stringify({
            storageKey: img.storageKey,
            sourceType: img.sourceType,
            sourceUrl: img.sourceType === 'EXTERNAL' ? img.sourceUrl.trim() : undefined,
            sortOrder: i,
            isCover: i === 0,
          }),
        });
      }
      await authFetch(`/reference-requests/${draftId}/publish`, { method: 'POST' });
      router.push('/requests/mine');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '등록하지 못했습니다.');
      setPending(false);
    }
  }

  /** 임시저장하고 나간다. 시안의 헤더 버튼이 이 동작이다. */
  async function saveAndLeave() {
    setPending(true);
    try {
      await save();
      router.push('/requests/mine');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '저장하지 못했습니다.');
      setPending(false);
    }
  }

  /** 카드 아래 한 줄. 사진 수 · 희망 시기 · 자재를 잇는다. */
  function summaryMeta() {
    return (
      [
        images.length > 0 ? `사진 ${images.length}장` : null,
        TIMINGS.find((t) => t.key === timing)?.label,
        materialGrade ? `${MATERIAL_GRADE_LABELS[materialGrade]} 자재` : null,
      ]
        .filter(Boolean)
        .join(' · ') || '아직 입력 전'
    );
  }

  /** 4단계 요약 표. 시안은 항목별 한 줄씩 오른쪽 정렬로 값을 놓는다. */
  function summaryRows() {
    return [
      { k: '사진', v: `${images.length}장` },
      { k: '공종', v: categoryNames.join(', ') || '—' },
      { k: '지역', v: regionName || '—' },
      {
        k: '규모',
        v:
          [
            validPyeong ? `${pyeongNum}평` : null,
            housingType ? HOUSING_TYPE_LABELS[housingType] : null,
          ]
            .filter(Boolean)
            .join(' · ') || '—',
      },
      { k: '희망 시기', v: TIMINGS.find((t) => t.key === timing)?.label ?? '—' },
      { k: '자재 등급', v: materialGrade ? MATERIAL_GRADE_LABELS[materialGrade] : '—' },
    ];
  }

  const meta = STEPS[step];
  const counter = `${step + 1} / ${STEPS.length} 단계`;
  const progress = `${((step + 1) / STEPS.length) * 100}%`;
  const savedLabel = savedAt
    ? `${savedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 임시저장됨`
    : null;
  const showBlocked = tried && !!blocked;

  return (
    <>
      <div className="shell">
        <div className="wizard__topbar">
          <span className="wizard__topbar-title">의뢰 등록</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {savedLabel && <span className="wizard__saved">{savedLabel}</span>}
            <Button
              variant="secondary"
              size="md"
              onClick={() => void saveAndLeave()}
              disabled={pending || !draftId}
            >
              임시저장하고 나가기
            </Button>
          </div>
        </div>

        {/* 모바일 스텝 헤더. 데스크톱에서는 좌측 사이드바가 같은 일을 한다. */}
        <div className="wizard__mobile-head">
          <div className="wizard__mobile-row">
            <span className="wizard__mobile-title">{meta?.title}</span>
            <span className="wizard__counter">{counter}</span>
          </div>
          <div
            className="wizard__bar"
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-label="등록 진행률"
          >
            <span style={{ width: progress }} />
          </div>
        </div>
      </div>

      <div className="wizard">
        {/* ── 좌측: 단계 ────────────────────────────────── */}
        <nav aria-label="등록 단계" className="wizard__nav">
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <button
                key={s.title}
                type="button"
                className={`wizard__step${done ? ' wizard__step--done' : ''}`}
                aria-current={current ? 'step' : undefined}
                /*
                 * 지나온 단계까지만 누를 수 있다. 앞 단계로 건너뛰면 검증을 지나치고,
                 * 그러면 사진 0장짜리 의뢰가 등록될 수 있다.
                 * 지금 단계는 눌러도 아무 일이 없지만 잠그지는 않는다 —
                 * 현재 위치가 비활성으로 보이면 어디까지 갈 수 있는지가 흐려진다.
                 */
                disabled={i > step}
                onClick={() => {
                  setStep(i);
                  setTried(false);
                }}
              >
                <span className="wizard__mark" aria-hidden="true">
                  {done ? '✓' : i + 1}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="wizard__step-title">{s.title}</span>
                  <span className="wizard__step-hint">{s.hint}</span>
                </span>
              </button>
            );
          })}

          <div className="wizard__progress-box">
            <span className="wizard__progress-label">진행률</span>
            <div
              className="wizard__bar"
              role="progressbar"
              aria-valuenow={step + 1}
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              aria-label="등록 진행률"
            >
              <span style={{ width: progress }} />
            </div>
            <span className="wizard__counter">{counter}</span>
          </div>
        </nav>

        {/* ── 가운데: 본문 ──────────────────────────────── */}
        <main className="wizard__main">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h1 className="wizard__h1">{meta?.title}</h1>
            <p className="wizard__lead">{meta?.lead}</p>
          </div>

          <FormError message={error} />

          {/* ── 1. 사진 ──────────────────────────────────── */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {draftId ? (
                <ImageUploader
                  mode="reference"
                  images={images}
                  max={MAX_REFERENCE_IMAGES}
                  onChange={setImages}
                  authFetch={authFetch}
                />
              ) : (
                <span className="wizard__step-hint">준비 중…</span>
              )}
              {images.length > 0 && (
                <span className="wizard__step-hint">
                  {images.length}장 · 첫 번째 사진이 대표로 쓰입니다
                </span>
              )}

              {/*
                저작권 고지. 시안은 이걸 체크박스 한 줄로 받지만 구현은 **사진마다**
                SELF/EXTERNAL 과 원본 주소를 받는다(위 업로더). 구현이 시안보다 엄격한
                쪽이라 유지하고, 대신 시안의 상자 모양은 그대로 가져왔다 —
                문단으로 흘려두면 이 화면에서 가장 읽어야 하는 문장을 읽지 않는다.
              */}
              <p className="wizard__consent">
                직접 촬영했거나 사용 권리가 있는 사진을 올려주세요. 남의 사진은 사진마다 원본 주소를
                함께 남기면 됩니다 — 의뢰 사진은 검색에 노출되지 않고 로그인한 시공자에게만
                전달됩니다.
              </p>
            </div>
          )}

          {/* ── 2. 공종 · 자재 ───────────────────────────── */}
          {step === 1 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 22,
                maxWidth: 680,
              }}
            >
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

              {/*
                자재 등급을 여기 둔 이유는 시안이 그렇게 묶었기 때문이다 —
                "무슨 공사"와 "어느 정도로"는 같은 질문의 앞뒤다.
              */}
              <div
                style={{
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <span className="wizard__group-label">자재 등급</span>
                <div className="grade-row" role="group" aria-label="자재 등급">
                  {MATERIAL_GRADES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      className="grade"
                      aria-pressed={materialGrade === g}
                      /* 같은 걸 다시 누르면 해제된다. 자재 등급은 필수가 아니다. */
                      onClick={() => setMaterialGrade(materialGrade === g ? '' : g)}
                    >
                      <span className="grade__label">{MATERIAL_GRADE_LABELS[g]}</span>
                      <span className="grade__hint">{MATERIAL_GRADE_HINTS[g]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 3. 조건 ──────────────────────────────────── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 680 }}>
              {/*
                시안은 지역·평형·주거형태를 한 줄(2fr 1fr 1fr)에 깐다.
                지역만 2단계 셀렉트라 그 칸 안에서 다시 둘로 나눈다 — 확장 규약 3조.
              */}
              <div className="wizard__grid3">
                <Field
                  label="시공 지역"
                  hint="동까지만 공개됩니다. 상세 주소는 컨택 수락 후에 전달합니다."
                >
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

                {/* 확장 규약 1조 — 숫자 입력이다. "24평쯤" 을 받을 칸이 없다. */}
                <Field
                  label="평형"
                  hint={
                    validPyeong
                      ? `약 ${(pyeongNum * SQUARE_METERS_PER_PYEONG).toFixed(1)}㎡`
                      : '평 단위 숫자'
                  }
                >
                  <input
                    type="number"
                    inputMode="numeric"
                    min={MIN_PYEONG}
                    max={MAX_PYEONG}
                    value={pyeong}
                    onChange={(e) => setPyeong(e.target.value)}
                    placeholder="24"
                    className="input"
                  />
                </Field>

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

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="wizard__group-label wizard__group-label--sm">희망 시기</span>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {TIMINGS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      className="chip chip--lg"
                      aria-pressed={timing === t.key}
                      onClick={() => setTiming(t.key)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <Field label="덧붙일 말 (선택)">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="예) 거주 중이라 주말 시공을 원합니다"
                  className="input"
                />
              </Field>
            </div>
          )}

          {/* ── 4. 확인 ──────────────────────────────────── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="wizard__summary">
                {/*
                  **시공자에게 뭐가 보이는지 그대로 보여준다.**
                  뭘 공개하는지 모르는 채로 등록 버튼을 누르게 하면 안 된다.
                */}
                <div className="preview-card">
                  <div className="preview-card__media">
                    {images[0] && <img src={images[0].previewUrl} alt="대표 사진" />}
                    <span className="card-photo__tag">대표 사진</span>
                  </div>
                  <div className="preview-card__body">
                    <strong className="wizard__cover-title">{title}</strong>
                    <span className="preview-card__meta">{summaryMeta()}</span>
                  </div>
                </div>

                <div className="wizard__summary-rows">
                  {summaryRows().map((row) => (
                    <div key={row.k} className="wizard__summary-row">
                      <span className="wizard__summary-k">{row.k}</span>
                      <span className="wizard__summary-v">{row.v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="wizard__aside-note">
                등록하면 조건에 맞는 시공자에게 노출됩니다. 이름·연락처·상세 주소는 컨택을 수락한
                시공자에게만 공개됩니다.
              </p>
            </div>
          )}

          {/* ── 이동 (데스크톱) ──────────────────────────── */}
          <div className="wizard__foot">
            <Button
              variant="secondary"
              size="lg"
              className="wizard__cta"
              onClick={() => {
                setStep((s) => Math.max(0, s - 1));
                setTried(false);
              }}
              disabled={pending || step === 0}
            >
              이전
            </Button>
            <div className="wizard__foot-right">
              {showBlocked && (
                <span role="alert" className="wizard__blocked">
                  {blocked}
                </span>
              )}
              <Button
                variant="primary"
                size="lg"
                className="wizard__cta"
                pending={pending}
                disabled={!draftId}
                onClick={() => void (step === 3 ? submit() : next())}
              >
                {step === 3 ? '의뢰 등록하기' : '다음'}
              </Button>
            </div>
          </div>
        </main>

        {/* ── 우측: 시공자에게 보이는 모습 ──────────────── */}
        <aside className="wizard__aside" aria-label="시공자에게 보이는 모습">
          <span className="wizard__aside-title">시공자에게는 이렇게 보입니다</span>
          <div className="preview-card">
            <div className="preview-card__media">
              {images[0] && <img src={images[0].previewUrl} alt="" />}
              {categoryNames[0] && <span className="card-photo__tag">{categoryNames[0]}</span>}
              {images.length > 0 && <span className="card-photo__count">{images.length}장</span>}
            </div>
            <div className="preview-card__body">
              <strong className="preview-card__title">{title}</strong>
              <span className="preview-card__meta">{summaryMeta()}</span>
              {/* 등록 직후 상태를 미리 보여준다. 올리면 무엇이 되는지가 여기서 읽힌다. */}
              <span className="badge badge--warning" style={{ width: 'fit-content', marginTop: 4 }}>
                제안 받는 중
              </span>
            </div>
          </div>
          <p className="wizard__aside-note">
            사진과 조건만 공개됩니다. 이름·연락처·상세 주소는 컨택을 수락한 시공자에게만 열립니다.
          </p>
        </aside>
      </div>

      {/* ── 이동 (모바일 하단 고정) ────────────────────── */}
      <div className="shell">
        <div className="sticky-cta">
          {showBlocked && (
            <span
              role="alert"
              className="wizard__blocked"
              style={{ display: 'block', marginBottom: 'var(--space-2)' }}
            >
              {blocked}
            </span>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {step > 0 && (
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  setStep((s) => s - 1);
                  setTried(false);
                }}
                disabled={pending}
              >
                이전
              </Button>
            )}
            <Button
              variant="primary"
              size="lg"
              block
              pending={pending}
              disabled={!draftId}
              onClick={() => void (step === 3 ? submit() : next())}
            >
              {step === 3 ? '의뢰 등록하기' : '다음'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
