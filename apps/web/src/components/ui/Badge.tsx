import type { ReactNode } from 'react';

/**
 * 뱃지.
 *
 * **정본은 시안 04 COMPONENTS 의 "뱃지 — 인증 · 상태" 블록이다.**
 *
 * 시안이 색을 이렇게 나눠뒀다.
 * - `verified` 만 secondary(클레이)를 쓴다. 아껴 쓰기 때문에 나올 때마다 의미를 갖는다.
 * - 컨택 상태는 success / warning / danger.
 * - 그 외 중립 정보는 회색이다.
 *
 * 색을 화면에서 고르게 하면 이 구분이 곧 무너진다. 그래서 tone 이름으로만 받는다.
 */

type Tone = 'verified' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'muted';

/**
 * `xs` 는 시안이 좁은 카드 안에서 쓰는 22px 높이 변형이다.
 * 크기는 두 개뿐이다 — 늘리면 같은 뱃지가 화면마다 달라진다.
 */
type Size = 'xs' | 'md';

export function Badge({
  children,
  tone = 'neutral',
  size = 'md',
}: {
  children: ReactNode;
  tone?: Tone;
  size?: Size;
}) {
  return (
    <span className={`badge badge--${tone}${size === 'xs' ? ' badge--xs' : ''}`}>{children}</span>
  );
}
