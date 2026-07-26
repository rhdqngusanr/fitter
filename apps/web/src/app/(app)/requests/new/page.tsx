'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
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
} from '@fitter/shared';

import { Field, FormError, SubmitButton, inputStyle } from '../../../../components/form';
import { ImageUploader, type UploadedImage } from '../../../../components/ImageUploader';
import { ApiError, api } from '../../../../lib/api';
import { useSession } from '../../../../lib/session';

interface RegionTree {
  sido: { code: string; name: string; sigungu: { code: string; name: string }[] }[];
}

/**
 * 의뢰 등록 (C-01). **가장 중요한 화면이다.**
 *
 * 확장 규약을 화면에서 지키는 게 이 폼의 존재 이유다 —
 * 평수는 숫자 입력, 지역은 시도→시군구 2단계, 공종은 코드 테이블, 나머지는 enum.
 * 자유 텍스트로 받는 순간 2차 가격 기능의 데이터원이 통째로 망가진다.
 *
 * 근거: brain/20-도메인/확장 규약.md · brain/50-결정/ADR-010 - 가격 정책 모델.md
 */
export default function NewRequestPage() {
  const { user, loading, authFetch } = useSession();
  const router = useRouter();

  const [draftId, setDraftId] = useState<string | null>(null);
  const [regions, setRegions] = useState<RegionTree | null>(null);
  const [sido, setSido] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [pyeong, setPyeong] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);
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
   * 그래서 화면에 들어오는 순간 DRAFT 를 만든다. 공개는 마지막에 따로 한다.
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

  const toggle = useCallback((code: string) => {
    setCategories((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }, []);

  if (loading || !user?.profileType) return null;

  /* 평수를 치는 동안 ㎡를 같이 보여준다. 사람은 평으로 말하고 도면은 ㎡로 쓴다. */
  const pyeongNum = Number(pyeong);
  const squareMeters =
    pyeong && Number.isFinite(pyeongNum) && pyeongNum > 0
      ? (pyeongNum * SQUARE_METERS_PER_PYEONG).toFixed(1)
      : null;

  const sigungu = regions?.sido.find((s) => s.code === sido)?.sigungu ?? [];

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftId) return;
    setError(null);

    const data = new FormData(event.currentTarget);
    const num = (key: string) => {
      const raw = String(data.get(key) ?? '').trim();
      return raw === '' ? undefined : Number(raw);
    };

    /* 외부 출처인데 주소가 비면 서버도 DB도 거부한다. 여기서 먼저 잡아준다. */
    const missing = images.find((i) => i.sourceType === 'EXTERNAL' && !i.sourceUrl.trim());
    if (missing) {
      setError(`"${missing.name}" 의 원본 주소를 입력해 주세요.`);
      return;
    }
    if (images.length === 0) {
      setError('사진을 최소 한 장 올려주세요. 이 서비스는 사진으로 연결합니다.');
      return;
    }

    setPending(true);
    try {
      await authFetch(`/reference-requests/${draftId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: String(data.get('title')),
          description: String(data.get('description') || '') || undefined,
          /* 확장 규약 1조 — 숫자로 보낸다. */
          areaPyeong: num('areaPyeong'),
          housingType: String(data.get('housingType')) || undefined,
          /* 확장 규약 3조 — 시군구 코드로 보낸다. */
          regionCode: String(data.get('regionCode')) || undefined,
          /* 확장 규약 2조 — 코드 배열이다. 한글 라벨이 아니다. */
          workCategoryCodes: categories,
          materialGrade: String(data.get('materialGrade')) || undefined,
          isOccupied: data.get('isOccupied') === 'on',
          budgetMin: num('budgetMin'),
          budgetMax: num('budgetMax'),
          floor: num('floor'),
          hasElevator: data.get('hasElevator') === 'on',
          needsDemolition: data.get('needsDemolition') === 'on',
        }),
      });

      /* 사진 행은 공개 직전에 한 번에 붙인다. 중간에 나가면 고아 파일은 배치가 치운다. */
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
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-10) var(--space-4)' }}>
      <h1 style={{ fontSize: 26, margin: '0 0 var(--space-2)' }}>이렇게 해주세요</h1>
      <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 var(--space-8)' }}>
        원하는 분위기의 사진과 조건을 남기면, 그 스타일을 시공해 본 사람이 문의합니다.
      </p>

      <FormError message={error} />

      <form onSubmit={onSubmit} noValidate>
        <Field label="한 줄 요약">
          <input
            name="title"
            required
            maxLength={100}
            placeholder="예) 성북구 24평 아파트 전체 도배"
            style={inputStyle}
          />
        </Field>

        <Field label="사진" hint="첫 장이 대표 사진이 됩니다.">
          {draftId ? (
            <ImageUploader
              requestId={draftId}
              images={images}
              max={MAX_REFERENCE_IMAGES}
              onChange={setImages}
              authFetch={authFetch}
            />
          ) : (
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>준비 중…</p>
          )}
        </Field>

        {/* 공종 목록은 packages/shared 가 정본이다. 화면이 자기 목록을 들고 있지 않는다. */}
        <Field label="필요한 공사" hint="여러 개 고를 수 있습니다.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {WORK_CATEGORY_SEEDS.map((c) => {
              const on = categories.includes(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => toggle(c.code)}
                  aria-pressed={on}
                  style={{
                    minHeight: 40,
                    padding: '0 var(--space-4)',
                    borderRadius: 'var(--radius-full)',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    cursor: 'pointer',
                    background: on ? 'var(--color-primary-500)' : 'var(--color-surface)',
                    color: on ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                    border: `1px solid ${on ? 'var(--color-primary-500)' : 'var(--color-border)'}`,
                  }}
                >
                  {c.nameKo}
                </button>
              );
            })}
          </div>
        </Field>

        {/* 확장 규약 3조 — 시도를 고른 뒤 시군구를 고른다. 주소 원문 칸은 없다. */}
        <Field label="지역">
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <select
              value={sido}
              onChange={(e) => setSido(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            >
              <option value="">시·도</option>
              {regions?.sido.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
            <select name="regionCode" required disabled={!sido} style={{ ...inputStyle, flex: 1 }}>
              <option value="">시·군·구</option>
              {sigungu.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </Field>

        {/* 확장 규약 1조 — 숫자 입력이다. "24평쯤" 같은 걸 받을 칸이 없다. */}
        <Field
          label="면적"
          hint={squareMeters ? `약 ${squareMeters}㎡` : '평 단위 숫자로 입력해 주세요.'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <input
              name="areaPyeong"
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
          <select name="housingType" style={inputStyle}>
            <option value="">선택 안 함</option>
            {HOUSING_TYPES.map((t) => (
              <option key={t} value={t}>
                {HOUSING_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="자재 등급" hint="정하지 않았다면 비워두셔도 됩니다.">
          <select name="materialGrade" style={inputStyle}>
            <option value="">선택 안 함</option>
            {MATERIAL_GRADES.map((g) => (
              <option key={g} value={g}>
                {MATERIAL_GRADE_LABELS[g]}
              </option>
            ))}
          </select>
        </Field>

        {/*
          현장 변수. ADR-010이 요구한 항목이고 전부 선택이다.
          안 받으면 나중에 소급할 수 없어서 지금부터 받는다.
        */}
        <Field label="현장 조건" hint="아는 만큼만 알려주셔도 됩니다.">
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <input name="floor" type="number" placeholder="층" style={{ ...inputStyle, flex: 1 }} />
            <input
              name="budgetMin"
              type="number"
              inputMode="numeric"
              placeholder="예산 최소(원)"
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              name="budgetMax"
              type="number"
              inputMode="numeric"
              placeholder="예산 최대(원)"
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)', fontSize: 14 }}>
            <label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <input name="hasElevator" type="checkbox" /> 엘리베이터 있음
            </label>
            <label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <input name="isOccupied" type="checkbox" /> 거주 중
            </label>
            <label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <input name="needsDemolition" type="checkbox" /> 철거 필요
            </label>
          </div>
        </Field>

        <Field label="더 하고 싶은 말">
          <textarea
            name="description"
            maxLength={2000}
            rows={5}
            placeholder="원하는 느낌, 꼭 지켜야 할 조건, 일정 같은 걸 자유롭게 적어주세요."
            style={{
              ...inputStyle,
              height: 'auto',
              padding: 'var(--space-3) var(--space-4)',
              resize: 'vertical',
            }}
          />
        </Field>

        <SubmitButton pending={pending} disabled={!draftId}>
          의뢰 올리기
        </SubmitButton>
        <p
          style={{
            fontSize: 13,
            color: 'var(--color-text-tertiary)',
            marginTop: 'var(--space-3)',
            textAlign: 'center',
          }}
        >
          올린 의뢰는 로그인한 시공자에게만 보입니다. 검색에는 잡히지 않습니다.
        </p>
      </form>
    </main>
  );
}
