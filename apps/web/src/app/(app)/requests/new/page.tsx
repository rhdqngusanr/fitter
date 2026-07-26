'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  HOUSING_TYPES,
  HOUSING_TYPE_LABELS,
  MATERIAL_GRADES,
  MATERIAL_GRADE_LABELS,
  MAX_PYEONG,
  MAX_REFERENCE_IMAGES,
  MIN_PYEONG,
  SQUARE_METERS_PER_PYEONG,
  WORK_CATEGORY_SEEDS,
  type HousingType,
  type MaterialGrade,
} from '@fitter/shared';

import { Field, FormError, inputStyle } from '../../../../components/form';
import { ImageUploader, type UploadedImage } from '../../../../components/ImageUploader';
import { ApiError, api } from '../../../../lib/api';
import { useSession } from '../../../../lib/session';

interface RegionTree {
  sido: { code: string; name: string; sigungu: { code: string; name: string }[] }[];
}

const STEPS = [
  { title: '사진 올리기', hint: '3~10장 권장' },
  { title: '공종 고르기', hint: '복수 선택 가능' },
  { title: '조건 입력', hint: '지역 · 평형 · 시기' },
  { title: '확인하고 등록', hint: '마지막 단계' },
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
    if (blocked) return;
    setError(null);
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

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: 'var(--space-8) var(--space-4)' }}>
      {/* 어디까지 왔는지. 4단계라는 걸 처음부터 보여줘야 중간에 안 나간다. */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-3)',
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>
          {step + 1} / {STEPS.length} 단계
        </span>
        {savedAt && (
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            {savedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 임시저장됨
          </span>
        )}
      </div>

      <div
        aria-hidden="true"
        style={{
          height: 4,
          borderRadius: 'var(--radius-full)',
          background: 'var(--color-bg-sunken)',
          marginBottom: 'var(--space-6)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${((step + 1) / STEPS.length) * 100}%`,
            height: '100%',
            background: 'var(--color-primary-500)',
          }}
        />
      </div>

      <h1 style={{ fontSize: 24, margin: '0 0 var(--space-2)', fontWeight: 800 }}>
        {STEPS[step]?.title}
      </h1>

      <FormError message={error} />

      {/* ── 1. 사진 ──────────────────────────────────── */}
      {step === 0 && (
        <>
          <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 var(--space-6)' }}>
            마음에 든 사진을 올려주세요. 3장 이상이면 시공자가 이해하기 쉽습니다. 인테리어 용어는
            몰라도 됩니다 — 사진이 곧 요구사항입니다.
          </p>
          {draftId ? (
            <ImageUploader
              mode="reference"
              images={images}
              max={MAX_REFERENCE_IMAGES}
              onChange={setImages}
              authFetch={authFetch}
            />
          ) : (
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>준비 중…</p>
          )}
          {images.length > 0 && (
            <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', margin: 0 }}>
              {images.length}장 · 첫 번째 사진이 대표로 쓰입니다
            </p>
          )}
        </>
      )}

      {/* ── 2. 공종 ──────────────────────────────────── */}
      {step === 1 && (
        <>
          <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 var(--space-6)' }}>
            어떤 공사가 필요한지 골라주세요. 여러 개 고를 수 있습니다.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-6)',
            }}
          >
            {WORK_CATEGORY_SEEDS.map((c) => {
              const on = categories.includes(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setCategories((prev) =>
                      prev.includes(c.code) ? prev.filter((x) => x !== c.code) : [...prev, c.code],
                    )
                  }
                  style={{
                    height: 40,
                    padding: '0 var(--space-4)',
                    borderRadius: 'var(--radius-full)',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: on ? 'var(--color-primary-500)' : 'var(--color-surface)',
                    color: on ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                    border: `1px solid ${on ? 'var(--color-primary-500)' : 'var(--color-border-strong)'}`,
                  }}
                >
                  {c.nameKo}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── 3. 조건 ──────────────────────────────────── */}
      {step === 2 && (
        <>
          <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 var(--space-6)' }}>
            시공자가 가능 여부를 판단할 최소 정보만 받습니다.
          </p>

          {/* 확장 규약 3조 — 시도→시군구 2단계. 주소 원문 칸은 없다. */}
          <Field
            label="시공 지역"
            hint="동까지만 공개됩니다. 상세 주소는 컨택 수락 후에 전달합니다."
          >
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <select
                value={sido}
                onChange={(e) => {
                  setSido(e.target.value);
                  setRegionCode('');
                }}
                style={{ ...inputStyle, flex: 1 }}
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
                style={{ ...inputStyle, flex: 1 }}
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
                : '평 단위 숫자로 입력해 주세요.'
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <input
                type="number"
                inputMode="numeric"
                min={MIN_PYEONG}
                max={MAX_PYEONG}
                value={pyeong}
                onChange={(e) => setPyeong(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <span style={{ color: 'var(--color-text-secondary)' }}>평</span>
            </div>
          </Field>

          <Field label="주거 형태">
            <ChipGroup
              items={HOUSING_TYPES.map((t) => ({ key: t, label: HOUSING_TYPE_LABELS[t] }))}
              value={housingType}
              onChange={(v) => setHousingType(v as HousingType)}
            />
          </Field>

          <Field label="희망 시기">
            <ChipGroup
              items={TIMINGS.map((t) => ({ key: t.key, label: t.label }))}
              value={timing}
              onChange={(v) => setTiming(v as (typeof TIMINGS)[number]['key'])}
            />
          </Field>

          <Field label="자재 등급" hint="정하지 않았다면 비워두셔도 됩니다.">
            <ChipGroup
              items={MATERIAL_GRADES.map((g) => ({ key: g, label: MATERIAL_GRADE_LABELS[g] }))}
              value={materialGrade}
              onChange={(v) => setMaterialGrade(v as MaterialGrade)}
            />
          </Field>

          <Field label="덧붙일 말 (선택)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="꼭 지켜야 할 조건이나 궁금한 점을 적어주세요."
              style={{
                ...inputStyle,
                height: 'auto',
                padding: 'var(--space-3) var(--space-4)',
                resize: 'vertical',
              }}
            />
          </Field>
        </>
      )}

      {/* ── 4. 확인 ──────────────────────────────────── */}
      {step === 3 && (
        <>
          <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 var(--space-6)' }}>
            이대로 등록하면 조건에 맞는 시공자에게 노출됩니다.
          </p>

          {/*
            **시공자에게 뭐가 보이는지 그대로 보여준다.**
            뭘 공개하는지 모르는 채로 등록 버튼을 누르게 하면 안 된다.
          */}
          <div
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              marginBottom: 'var(--space-5)',
              background: 'var(--color-surface)',
            }}
          >
            {images[0] && (
              <img
                src={images[0].previewUrl}
                alt="대표 사진"
                style={{
                  width: '100%',
                  aspectRatio: '4 / 3',
                  objectFit: 'cover',
                  display: 'block',
                  background: 'var(--color-bg-sunken)',
                }}
              />
            )}
            <div style={{ padding: 'var(--space-4)' }}>
              <strong style={{ display: 'block', marginBottom: 'var(--space-1)' }}>{title}</strong>
              <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                {[
                  `${images.length}장`,
                  TIMINGS.find((t) => t.key === timing)?.label,
                  materialGrade ? `${MATERIAL_GRADE_LABELS[materialGrade]} 자재` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
          </div>

          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 'var(--space-3)',
              margin: '0 0 var(--space-5)',
            }}
          >
            <Summary label="사진" value={`${images.length}장`} />
            <Summary label="공종" value={categoryNames.join(', ')} />
            <Summary label="지역" value={regionName} />
            <Summary
              label="규모"
              value={[`${pyeongNum}평`, housingType ? HOUSING_TYPE_LABELS[housingType] : null]
                .filter(Boolean)
                .join(' · ')}
            />
            <Summary label="희망 시기" value={TIMINGS.find((t) => t.key === timing)?.label ?? ''} />
            {materialGrade && (
              <Summary label="자재 등급" value={MATERIAL_GRADE_LABELS[materialGrade]} />
            )}
          </dl>

          <p
            style={{
              fontSize: 13,
              lineHeight: 1.7,
              color: 'var(--color-text-secondary)',
              background: 'var(--color-bg-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              margin: '0 0 var(--space-5)',
            }}
          >
            사진과 조건만 공개됩니다.{' '}
            <strong>이름·연락처·상세 주소는 컨택을 수락한 시공자에게만</strong> 열립니다.
          </p>
        </>
      )}

      {/*
        저작권 고지. 사진 단계에서 특히 중요하다 — 남의 사진을 올리는 게 이 서비스의
        구조적 리스크이고, 그래서 의뢰는 검색에 노출되지 않는다.
      */}
      {step === 0 && (
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.7,
            color: 'var(--color-text-tertiary)',
            margin: 'var(--space-4) 0 0',
          }}
        >
          직접 촬영했거나 사용 권리가 있는 사진을 올려주세요. 남의 사진은 원본 주소를 함께 남기면
          됩니다 — 의뢰 사진은 검색에 노출되지 않고 로그인한 시공자에게만 전달됩니다.
        </p>
      )}

      {/* ── 이동 ─────────────────────────────────────── */}
      {blocked && step < 3 && (
        <p
          style={{
            fontSize: 13,
            color: 'var(--color-text-tertiary)',
            margin: 'var(--space-5) 0 0',
            textAlign: 'center',
          }}
        >
          {blocked}
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={pending}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-strong)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: pending ? 'default' : 'pointer',
            }}
          >
            이전
          </button>
        )}
        <button
          type="button"
          onClick={() => void (step === 3 ? submit() : next())}
          disabled={pending || !draftId || !!blocked}
          style={{
            flex: 2,
            height: 48,
            borderRadius: 'var(--radius-md)',
            border: 'none',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: 'inherit',
            color: 'var(--color-text-inverse)',
            background:
              pending || !draftId || blocked
                ? 'var(--color-primary-300)'
                : 'var(--color-primary-500)',
            cursor: pending || !draftId || blocked ? 'default' : 'pointer',
          }}
        >
          {pending ? '처리 중…' : step === 3 ? '의뢰 등록하기' : '다음'}
        </button>
      </div>
    </main>
  );
}

/** 하나만 고르는 칩 묶음. 셀렉트보다 손가락으로 고르기 쉽고 선택지가 다 보인다. */
function ChipGroup({
  items,
  value,
  onChange,
}: {
  items: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
      {items.map((item) => {
        const on = value === item.key;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={on}
            /* 같은 걸 다시 누르면 해제된다. 선택을 되돌릴 방법이 없으면 안 된다. */
            onClick={() => onChange(on ? '' : item.key)}
            style={{
              height: 40,
              padding: '0 var(--space-4)',
              borderRadius: 'var(--radius-full)',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              background: on ? 'var(--color-primary-500)' : 'var(--color-surface)',
              color: on ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
              border: `1px solid ${on ? 'var(--color-primary-500)' : 'var(--color-border-strong)'}`,
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-subtle)',
        padding: '12px 14px',
      }}
    >
      <dt style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{label}</dt>
      <dd style={{ margin: '3px 0 0', fontSize: 15, fontWeight: 700 }}>{value || '—'}</dd>
    </div>
  );
}
