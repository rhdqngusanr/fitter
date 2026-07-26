'use client';

import { useState } from 'react';

import { IMAGE_PHASE_LABELS } from '@fitter/shared';

import { imageUrl, type PortfolioImage } from '../lib/api';

/**
 * 상세의 사진 영역 (C-05).
 *
 * **시안은 데스크톱과 모바일을 다르게 그렸다.**
 * - 데스크톱: 큰 사진 하나(2줄) + 작은 둘 모자이크, 남은 장수는 마지막 칸에 `+N` 으로 얹는다.
 * - 모바일: 4:3 한 장 + 우하단에 `3 / 8` 카운터.
 * - 둘 다 아래에 72×56 썸네일 줄이 있고, 그게 어느 사진을 볼지 고른다.
 *
 * 구현은 이 구조가 통째로 없었다 — 사진을 전부 나열하기만 했다. 사진이 8~11장인 사례에서
 * 그러면 화면이 스크롤로만 끝나고, 어느 사진이 대표인지도 안 보인다.
 *
 * **1200px 파생만 쓴다.** 원본은 어떤 화면에도 오지 않는다 — 무단 재사용을 조금이라도
 * 어렵게 만드는 게 저작권 리스크 대응의 일부다.
 */
export function PortfolioPhotos({ images, title }: { images: PortfolioImage[]; title: string }) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) return null;

  const selected = images[index] ?? images[0];
  if (!selected) return null;

  /*
   * 모자이크의 작은 칸은 선택한 사진 **다음** 것들이다. 끝에 닿으면 앞으로 돌아오되
   * 선택한 사진 자신은 절대 다시 넣지 않는다 — 사진이 2장인 사례에서 큰 칸과 작은 칸에
   * 같은 사진이 걸리고, 그건 버그로 보인다.
   */
  const side = Array.from(
    { length: images.length - 1 },
    (_, i) => images[(index + 1 + i) % images.length],
  )
    .filter((image): image is PortfolioImage => !!image)
    .slice(0, 2);
  /* 모자이크가 한 번에 보여주는 건 3장이다. 나머지 개수를 마지막 칸에 얹는다. */
  const remaining = Math.max(0, images.length - 3);
  /*
   * 사진이 3장 미만이면 시안의 배치(큰 것 1 + 작은 것 2)가 성립하지 않는다.
   * 빈 칸을 남기지 않고 있는 장수에 맞춰 칸을 나눈다.
   */
  const shape = images.length === 1 ? 'one' : images.length === 2 ? 'two' : 'full';

  const alt = (image: PortfolioImage) =>
    image.phase ? `${title} ${IMAGE_PHASE_LABELS[image.phase]}` : title;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* ── 모바일: 한 장 + 카운터 ── */}
      <div className="detail-hero">
        <Img image={selected} alt={alt(selected)} eager />
        {selected.phase && (
          <span className="detail-hero__phase">{IMAGE_PHASE_LABELS[selected.phase]}</span>
        )}
        {images.length > 1 && (
          <span className="detail-hero__count">
            {index + 1} / {images.length}
          </span>
        )}
      </div>

      {/* ── 데스크톱: 모자이크 ── */}
      <div className={`detail-mosaic detail-mosaic--${shape}`}>
        <div className="detail-mosaic__cell detail-mosaic__cell--big">
          <Img image={selected} alt={alt(selected)} eager />
          {selected.phase && (
            <span className="detail-hero__phase">{IMAGE_PHASE_LABELS[selected.phase]}</span>
          )}
        </div>
        {side.map((image, i) => {
          /* 남은 장수를 얹은 칸에는 단계 칩을 넣지 않는다 — 겹쳐서 둘 다 안 읽힌다. */
          const covered = i === side.length - 1 && remaining > 0;
          return (
            <div key={`${image.id}-${i}`} className="detail-mosaic__cell">
              <Img image={image} alt={alt(image)} />
              {/*
                작은 칸에도 단계를 적는다. 시공 전·후가 나란히 걸리는 화면에서
                큰 칸에만 라벨이 있으면 옆 사진이 무엇인지 알 수 없다 —
                before/after 대비가 이 서비스에서 실력을 가장 잘 보여주는 장치다.
              */}
              {image.phase && !covered && (
                <span className="detail-hero__phase">{IMAGE_PHASE_LABELS[image.phase]}</span>
              )}
              {/* 마지막 칸에만 남은 장수를 얹는다. 두 칸에 다 얹으면 숫자가 뭘 세는지 모른다. */}
              {covered && (
                <span className="detail-mosaic__more" aria-hidden="true">
                  +{remaining}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 썸네일 줄 ── */}
      {images.length > 1 && (
        <div className="detail-thumbs" role="group" aria-label="사진 고르기">
          {images.map((image, i) => {
            const thumb = imageUrl(image.thumb400Key ?? image.thumb1200Key);
            return (
              <button
                key={image.id}
                type="button"
                className="detail-thumb"
                aria-current={i === index}
                aria-label={`${i + 1}번 사진${image.phase ? ` · ${IMAGE_PHASE_LABELS[image.phase]}` : ''}`}
                onClick={() => setIndex(i)}
              >
                {thumb && <img src={thumb} alt="" loading="lazy" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 사진 한 장.
 *
 * `width`·`height` 를 적어야 브라우저가 사진이 도착하기 전에 자리를 잡는다.
 * 없으면 높이 0으로 그렸다가 사진이 오는 순간 아래 글이 통째로 밀린다.
 */
function Img({
  image,
  alt,
  eager = false,
}: {
  image: PortfolioImage;
  alt: string;
  eager?: boolean;
}) {
  const src = imageUrl(image.thumb1200Key ?? image.thumb400Key);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
    />
  );
}
