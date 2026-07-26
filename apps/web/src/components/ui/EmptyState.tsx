import type { ReactNode } from 'react';

/**
 * 빈 상태.
 *
 * **정본은 시안 04 COMPONENTS 의 "빈 상태" 블록이다.** 시안이 옆에 적어둔 한 줄이
 * 이 컴포넌트의 존재 이유다 — "콜드스타트 대비 — 기본값이 아니라 설계 대상".
 *
 * 그래서 제목·설명·행동을 전부 받는다. "결과가 없습니다" 한 줄로 끝내면
 * 사람은 여기서 나가고 다시 오지 않는다. 다음에 할 일을 같이 줘야 한다.
 */
export function EmptyState({
  title,
  body,
  actions,
}: {
  title: string;
  body?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty__icon" aria-hidden="true" />
      <strong className="empty__title">{title}</strong>
      {body && <span className="empty__body">{body}</span>}
      {actions && (
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            marginTop: 'var(--space-1)',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
