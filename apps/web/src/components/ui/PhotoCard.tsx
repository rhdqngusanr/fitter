import type { ReactNode } from 'react';

import { PhotoImg } from './PhotoImg';

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
  eager = false,
  wide = false,
}: {
  href: string;
  src?: string | null;
  alt: string;
  tag?: string;
  count?: number;
  title: string;
  meta: ReactNode;
  /** 사진 키 자체가 없을 때 그 자리에 보여줄 것. 로드 실패는 `PhotoImg` 가 따로 다룬다. */
  fallback?: ReactNode;
  /** 첫 화면에 바로 보이는 카드만 켠다. 전부 eager 면 아래쪽 사진이 위쪽을 늦춘다. */
  eager?: boolean;
  /** 데스크톱 4열 그리드용. 시안이 이때 본문 크기를 한 단 키운다. */
  wide?: boolean;
}) {
  return (
    <a href={href} className={wide ? 'card-photo card-photo--wide' : 'card-photo'}>
      <div className="card-photo__media">
        {src ? (
          /*
           * 목록에는 400px 파생만 온다. next/image 를 쓰지 않는 이유는 파생을 이미
           * 우리 파이프라인이 만들기 때문이다 — 두 번 리사이즈할 이유가 없다.
           *
           * `PhotoImg` 로 감싸는 이유는 시안이 그린 "이미지 에러" 상태다 —
           * 로드가 실패하면 카드 자리를 유지한 채 재시도 버튼을 준다.
           */
          <PhotoImg src={src} alt={alt} eager={eager} />
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
