/**
 * 스켈레톤.
 *
 * **정본은 시안 04 COMPONENTS 의 스켈레톤 블록(`fit-shimmer 1.4s`)이다.**
 *
 * 스피너 하나를 화면 가운데 돌리지 않고 들어올 내용의 모양을 미리 그린다.
 * 사진 그리드가 들어올 자리에 사진 크기의 사각형이 있으면 로딩이 끝날 때
 * 레이아웃이 튀지 않는다.
 */
export function Skeleton({
  width = '100%',
  height = 12,
  radius,
}: {
  width?: number | string;
  height?: number | string;
  radius?: string;
}) {
  return (
    <span
      className="skeleton"
      aria-hidden="true"
      style={{ display: 'block', width, height, borderRadius: radius }}
    />
  );
}

/** 사진 카드 자리를 잡아두는 스켈레톤. 갤러리·랜딩 그리드가 같은 모양을 쓴다. */
export function PhotoCardSkeleton() {
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        background: 'var(--color-bg)',
      }}
    >
      {/* 사진 자리. 시안의 카드와 같은 4:3 을 유지해야 로딩이 끝날 때 높이가 안 튄다. */}
      <span
        className="skeleton"
        aria-hidden="true"
        style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', borderRadius: 0 }}
      />
      <div
        style={{
          padding: '10px 12px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        <Skeleton width="80%" height={14} />
        <Skeleton width="52%" height={12} />
      </div>
    </div>
  );
}
