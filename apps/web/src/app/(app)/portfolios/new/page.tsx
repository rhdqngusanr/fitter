'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import {
  HOUSING_TYPES,
  HOUSING_TYPE_LABELS,
  MATERIAL_GRADES,
  MATERIAL_GRADE_LABELS,
  MAX_PORTFOLIO_IMAGES,
  MAX_PYEONG,
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
 * 포트폴리오 등록 (P-02).
 *
 * 시공자 쪽 입구다. **공개 조건이 두 개**라는 걸 화면이 미리 말해야 한다 —
 * 항목을 공개해도 관리자 승인 전에는 갤러리에 뜨지 않는다.
 * 올리고 나서 안 보이면 사람은 서비스가 고장 났다고 생각하고 떠난다.
 *
 * 근거: brain/20-도메인/엔티티 - PortfolioItem.md · brain/50-결정/ADR-011 - 신뢰 장치 설계.md
 */
export default function NewPortfolioPage() {
  const { user, loading, authFetch } = useSession();
  const router = useRouter();

  const [draftId, setDraftId] = useState<string | null>(null);
  const [regions, setRegions] = useState<RegionTree | null>(null);
  const [sido, setSido] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [pyeong, setPyeong] = useState('');
  const [costPublic, setCostPublic] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

  if (loading || user?.profileType !== 'PRO') return null;

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

    if (images.length === 0) {
      setError('사진을 최소 한 장 올려주세요. 고객은 사진을 보고 문의합니다.');
      return;
    }

    const data = new FormData(event.currentTarget);
    const num = (key: string) => {
      const raw = String(data.get(key) ?? '').trim();
      return raw === '' ? undefined : Number(raw);
    };

    setPending(true);
    try {
      await authFetch(`/portfolios/${draftId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: String(data.get('title')),
          description: String(data.get('description') || '') || undefined,
          areaPyeong: num('areaPyeong'),
          housingType: String(data.get('housingType')) || undefined,
          regionCode: String(data.get('regionCode')) || undefined,
          workCategoryCodes: categories,
          materialGrade: String(data.get('materialGrade')) || undefined,
          workDays: num('workDays'),
          workedAt: String(data.get('workedAt')) || undefined,
          /* 공개하지 않기로 했으면 금액을 아예 보내지 않는다. 서버도 그 조합을 거부한다. */
          isCostPublic: costPublic,
          ...(costPublic ? { actualCost: num('actualCost') } : {}),
        }),
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

      await authFetch(`/portfolios/${draftId}/publish`, { method: 'POST' });
      router.push('/portfolios/mine');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '등록하지 못했습니다.');
      setPending(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-10) var(--space-4)' }}>
      <h1 style={{ fontSize: 26, margin: '0 0 var(--space-2)' }}>시공 사례 올리기</h1>
      <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 var(--space-8)' }}>
        올린 사진을 보고 고객이 먼저 문의합니다.
      </p>

      <FormError message={error} />

      <form onSubmit={onSubmit} noValidate>
        <Field label="한 줄 요약">
          <input
            name="title"
            required
            maxLength={100}
            placeholder="예) 길음동 24평 아파트 전체 도배"
            style={inputStyle}
          />
        </Field>

        <Field label="사진" hint="시공 전·후를 같이 올리면 대비가 보입니다.">
          {draftId ? (
            <ImageUploader
              mode="portfolio"
              images={images}
              max={MAX_PORTFOLIO_IMAGES}
              onChange={setImages}
              authFetch={authFetch}
            />
          ) : (
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>준비 중…</p>
          )}
        </Field>

        <Field label="공종" hint="여러 개 고를 수 있습니다.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
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

        <Field label="시공 정보">
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <select name="housingType" style={{ ...inputStyle, flex: 1 }}>
              <option value="">주거 형태</option>
              {HOUSING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {HOUSING_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <select name="materialGrade" style={{ ...inputStyle, flex: 1 }}>
              <option value="">자재 등급</option>
              {MATERIAL_GRADES.map((g) => (
                <option key={g} value={g}>
                  {MATERIAL_GRADE_LABELS[g]}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <input
              name="workDays"
              type="number"
              min={1}
              max={365}
              placeholder="공사 일수"
              style={{ ...inputStyle, flex: 1 }}
            />
            <input name="workedAt" type="date" style={{ ...inputStyle, flex: 1 }} />
          </div>
        </Field>

        {/*
          비용 공개는 강제할 수 없어서 유인으로 접근한다. 공개하면 뱃지를 준다.
          체크를 풀면 금액 칸 자체가 사라진다 — 안 쓸 값을 화면에 남겨두지 않는다.
        */}
        <Field
          label="실제 비용"
          hint="공개하면 카드에 '비용 공개' 표시가 붙습니다. 고객이 제일 궁금해하는 정보입니다."
        >
          <label
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              alignItems: 'center',
              marginBottom: costPublic ? 'var(--space-3)' : 0,
              fontSize: 14,
              color: 'var(--color-text-secondary)',
            }}
          >
            <input
              type="checkbox"
              checked={costPublic}
              onChange={(e) => setCostPublic(e.target.checked)}
            />
            실제 시공 비용을 공개합니다
          </label>
          {costPublic && (
            <input
              name="actualCost"
              type="number"
              inputMode="numeric"
              min={1}
              required
              placeholder="총 비용 (원)"
              style={inputStyle}
            />
          )}
        </Field>

        <Field label="설명">
          <textarea
            name="description"
            rows={5}
            maxLength={2000}
            placeholder="어떤 조건이었고 무엇을 신경 썼는지 적어주세요."
            style={{
              ...inputStyle,
              height: 'auto',
              padding: 'var(--space-3) var(--space-4)',
              resize: 'vertical',
            }}
          />
        </Field>

        <SubmitButton pending={pending} disabled={!draftId}>
          사례 올리기
        </SubmitButton>

        {/* 공개 조건이 두 개라는 걸 올리기 전에 말한다. 나중에 알면 속았다고 느낀다. */}
        <p
          style={{
            fontSize: 13,
            color: 'var(--color-text-tertiary)',
            marginTop: 'var(--space-3)',
            textAlign: 'center',
          }}
        >
          {user.profileType === 'PRO' && '관리자 승인 전에는 갤러리에 노출되지 않습니다.'}
        </p>
      </form>
    </main>
  );
}
