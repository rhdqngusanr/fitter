import type { ReactNode } from 'react';

/**
 * 사진 카드.
 *
 * **정본은 시안 04 COMPONENTS 의 카드 블록(`.card-photo`)이다.**
 * 갤러리·랜딩·의뢰 목록이 전부 같은 카드를 쓴다 — 화면마다 다시 만들면
 * 같은 서비스의 같은 물건이 화면마다 다르게 생긴다.
 *
 * 시안이 정한 것들.
 * - 사진은 4:3. 세로 사진이 섞여도 그리드가 들쭉날쭉해지지 않는다.
 * - 좌상단 태그는 **불투명 흰 칩**, 우하단 장수는 scrim. 사진 위에 컬러를 얹지 않는다.
 * - 그림자는 hover 에서만. 평상시 경계는 보더다(그림자는 사진 가장자리를 흐린다).
 */
export function PhotoCard({
  href,
  src,
  alt,
  tag,
  count,
  title,
  meta,
  fallback,
}: {
  href: string;
  src?: string | null;
  alt: string;
  tag?: string;
  count?: number;
  title: string;
  meta: ReactNode;
  /** 이미지가 없거나 실패했을 때 그 자리에 보여줄 것. 시안의 "이미지 실패" 상태. */
  fallback?: ReactNode;
}) {
  return (
    <a href={href} className="card-photo">
      <div className="card-photo__media">
        {src ? (
          /*
           * 목록에는 400px 파생만 온다. next/image 를 쓰지 않는 이유는 파생을 이미
           * 우리 파이프라인이 만들기 때문이다 — 두 번 리사이즈할 이유가 없다.
           */
          <img src={src} alt={alt} loading="lazy" />
        ) : (
          (fallback ?? <PhotoFallback />)
        )}
        {tag && <span className="card-photo__tag">{tag}</span>}
        {/* 장수는 2장 이상일 때만 쓴다. "1장"은 정보가 아니다. */}
        {count !== undefined && count > 1 && <span className="card-photo__count">{count}장</span>}
      </div>
      <div className="card-photo__body">
        <span className="card-photo__title">{title}</span>
        <span className="card-photo__meta">{meta}</span>
      </div>
    </a>
  );
}

/**
 * 사진이 없을 때 자리를 지키는 면.
 *
 * 깨진 이미지 아이콘을 그대로 두지 않는 이유: 사진이 주인공인 서비스에서
 * 깨진 아이콘은 서비스가 고장난 것처럼 보인다. 카드의 나머지 정보는 여전히 쓸 만하다.
 */
export function PhotoFallback({ label = '사진을 불러올 수 없습니다' }: { label?: string }) {
  return (
    <span
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-sunken)',
        color: 'var(--color-text-tertiary)',
        fontSize: 12,
        textAlign: 'center',
        padding: 'var(--space-4)',
      }}
    >
      {label}
    </span>
  );
}
