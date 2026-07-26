'use client';

import { useRef, useState } from 'react';

import {
  IMAGE_PHASES,
  IMAGE_PHASE_LABELS,
  MAX_IMAGE_BYTES,
  type ImagePhase,
  type ImageSourceType,
} from '@fitter/shared';

import type { ApiOptions } from '../lib/api';
import { inputStyle } from './form';

/**
 * 사진 업로더. 의뢰와 포트폴리오가 같이 쓴다.
 *
 * 사진마다 한 가지를 더 묻는데, **무엇을 묻는지가 용도마다 다르다.**
 *
 * - 의뢰(`reference`)는 **출처**를 묻는다. 고객이 인터넷에서 가져온 남의 저작물일 확률이
 *   높고, 한 의뢰 안에서도 "내가 찍은 것"과 "어디서 본 것"이 섞인다. 의뢰 단위로 한 번만
 *   물으면 그 구분이 사라져서, 신고가 들어왔을 때 어느 사진이 문제인지 특정할 수 없다.
 * - 포트폴리오(`portfolio`)는 **단계**를 묻는다. 시공자 본인의 작업물이라 출처를 물을
 *   이유가 없고, before/after 대비가 실력을 가장 설득력 있게 보여준다.
 *
 * 근거: brain/10-제품/리스크 - 레퍼런스 사진 저작권.md · brain/20-도메인/이미지 파이프라인.md
 */

/* 문구에 쓸 MB. 숫자를 직접 적지 않고 정본 상수에서 만든다. */
const MAX_IMAGE_MB = Math.round(MAX_IMAGE_BYTES / 1024 / 1024);

export interface UploadedImage {
  storageKey: string;
  name: string;
  previewUrl: string;
  /** 의뢰에서만 쓴다. */
  sourceType: ImageSourceType;
  sourceUrl: string;
  /** 포트폴리오에서만 쓴다. */
  phase: ImagePhase | null;
}

interface Props {
  mode: 'reference' | 'portfolio';
  images: UploadedImage[];
  max: number;
  onChange: (next: UploadedImage[]) => void;
  authFetch: <T>(path: string, options?: ApiOptions) => Promise<T>;
}

export function ImageUploader({ mode, images, max, onChange, authFetch }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setError(null);

    const room = max - images.length;
    if (files.length > room) {
      setError(`사진은 ${max}장까지 올릴 수 있습니다. ${room}장 더 올릴 수 있어요.`);
      return;
    }

    setBusy(true);
    const added: UploadedImage[] = [];
    try {
      for (const file of Array.from(files)) {
        /* 서버도 막지만 여기서 먼저 거른다. 다 올린 뒤에 거절당하면 화가 난다. */
        if (file.size > MAX_IMAGE_BYTES) {
          throw new Error(`${file.name} 은(는) 너무 큽니다. 한 장당 ${MAX_IMAGE_MB}MB까지입니다.`);
        }

        const intent = await authFetch<{ url: string; storageKey: string }>('/images/presign', {
          method: 'POST',
          body: JSON.stringify({
            namespace: mode === 'reference' ? 'REFERENCE' : 'PORTFOLIO',
            contentType: file.type,
            contentLength: file.size,
            currentCount: images.length + added.length,
          }),
        });

        /* 서명 URL로 바로 올린다. 파일이 API 서버를 거치지 않는다. */
        const put = await fetch(intent.url, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
        if (!put.ok) throw new Error(`${file.name} 업로드에 실패했습니다.`);

        added.push({
          storageKey: intent.storageKey,
          name: file.name,
          previewUrl: URL.createObjectURL(file),
          /* 의뢰 기본값은 "직접 촬영"이 아니다. 잘못 신고되는 쪽이 훨씬 비싸다. */
          sourceType: 'EXTERNAL',
          sourceUrl: '',
          /* 포트폴리오 기본값은 AFTER다. 대부분 결과 사진을 먼저 올린다. */
          phase: mode === 'portfolio' ? 'AFTER' : null,
        });
      }
      onChange([...images, ...added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드하지 못했습니다.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  function patch(index: number, change: Partial<UploadedImage>) {
    onChange(images.map((img, i) => (i === index ? { ...img, ...change } : img)));
  }

  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => void add(e.target.files)}
      />

      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy || images.length >= max}
        style={{
          width: '100%',
          minHeight: 96,
          border: '2px dashed var(--color-border-strong)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-bg-subtle)',
          color: 'var(--color-text-secondary)',
          fontFamily: 'inherit',
          fontSize: 15,
          cursor: busy || images.length >= max ? 'default' : 'pointer',
        }}
      >
        {busy
          ? '올리는 중…'
          : images.length >= max
            ? `사진 ${max}장을 다 채웠습니다`
            : `사진 고르기 (${images.length}/${max})`}
      </button>

      {error && (
        <p
          role="alert"
          style={{ color: 'var(--color-danger)', fontSize: 14, marginTop: 'var(--space-2)' }}
        >
          {error}
        </p>
      )}

      {images.map((img, i) => (
        <div
          key={img.storageKey}
          style={{
            display: 'flex',
            gap: 'var(--space-4)',
            padding: 'var(--space-4)',
            marginTop: 'var(--space-3)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <img
            src={img.previewUrl}
            alt={img.name}
            style={{
              width: 88,
              height: 88,
              objectFit: 'cover',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg-sunken)',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-2)',
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--color-text-tertiary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {img.name}
              </span>
              <button
                type="button"
                onClick={() => onChange(images.filter((_, j) => j !== i))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-danger)',
                  fontSize: 13,
                  cursor: 'pointer',
                  minHeight: 'auto',
                  padding: 0,
                }}
              >
                삭제
              </button>
            </div>

            {mode === 'reference' ? (
              <>
                {/* 출처는 사진마다 묻는다. 라디오라 안 고르고 넘어갈 수 없다. */}
                <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 14 }}>
                  <label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <input
                      type="radio"
                      name={`src-${img.storageKey}`}
                      checked={img.sourceType === 'SELF'}
                      onChange={() => patch(i, { sourceType: 'SELF', sourceUrl: '' })}
                    />
                    직접 찍었어요
                  </label>
                  <label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <input
                      type="radio"
                      name={`src-${img.storageKey}`}
                      checked={img.sourceType === 'EXTERNAL'}
                      onChange={() => patch(i, { sourceType: 'EXTERNAL' })}
                    />
                    어디서 봤어요
                  </label>
                </div>

                {/* 외부 출처면 원본 주소가 필수다. DB 제약도 같은 걸 강제한다. */}
                {img.sourceType === 'EXTERNAL' && (
                  <input
                    type="url"
                    required
                    placeholder="원본 주소 (https://…)"
                    value={img.sourceUrl}
                    onChange={(e) => patch(i, { sourceUrl: e.target.value })}
                    style={{
                      ...inputStyle,
                      height: 40,
                      marginTop: 'var(--space-2)',
                      fontSize: 14,
                    }}
                  />
                )}
              </>
            ) : (
              /* 포트폴리오는 단계를 받는다. 출처는 묻지 않는다 — 본인 작업물이다. */
              <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 14 }}>
                {IMAGE_PHASES.map((p) => (
                  <label
                    key={p}
                    style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}
                  >
                    <input
                      type="radio"
                      name={`phase-${img.storageKey}`}
                      checked={img.phase === p}
                      onChange={() => patch(i, { phase: p })}
                    />
                    {IMAGE_PHASE_LABELS[p]}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 'var(--space-3)' }}>
        {mode === 'reference'
          ? '남의 사진을 올릴 때는 원본 주소를 함께 남겨주세요. 권리자가 내려달라고 하면 그 사진만 내립니다.'
          : '시공 전과 후를 같이 올리면 문의가 훨씬 많이 옵니다.'}
      </p>
    </div>
  );
}
