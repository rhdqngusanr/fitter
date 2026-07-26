'use client';

import { useState } from 'react';

/**
 * 사진 한 장 + 로드 실패 처리.
 *
 * **시안이 그린 5상태 중 "이미지 에러"가 이것이다** — "카드 자리는 유지하고 재시도 버튼을
 * 준다. 레이아웃은 흔들리지 않는다."
 *
 * 왜 클라이언트 컴포넌트인가. 로드 실패는 브라우저에서만 알 수 있다. 서버는 키가 있는지
 * 없는지까지만 안다. 그래서 이 한 조각만 클라이언트로 두고 나머지 화면은 SSR 로 남긴다.
 *
 * 재시도는 쿼리스트링을 붙여 다시 요청한다. 같은 URL 로 다시 그리면 브라우저가
 * 실패한 응답을 캐시에서 그대로 꺼내서 아무 일도 일어나지 않는다.
 */
export function PhotoImg({
  src,
  alt,
  eager = false,
}: {
  src: string;
  alt: string;
  eager?: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          background: 'var(--color-bg-sunken)',
          padding: 'var(--space-3)',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          사진을 불러오지 못했습니다
        </span>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={(event) => {
            // 카드 전체가 링크라서 클릭이 위로 올라가면 상세로 넘어가 버린다.
            event.preventDefault();
            event.stopPropagation();
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        >
          다시 시도
        </button>
      </span>
    );
  }

  return (
    <img
      src={attempt === 0 ? src : `${src}?retry=${attempt}`}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
    />
  );
}
