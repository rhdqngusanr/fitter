import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * 버튼.
 *
 * **정본은 `design/Fitter 디자인 시스템 v1.dc.html` 04 COMPONENTS 의 버튼 블록이다.**
 * 크기 3종(sm 32 · md 40 · lg 48)과 변형 4종을 시안이 정해뒀고, 화면은 그중에서 고른다.
 * 화면이 자기 버튼 스타일을 다시 쓰지 않는다 — 그게 "주 행동 1개" 규칙이 무너지는 방식이다.
 *
 * `pending` 과 `disabled` 를 나눠 받는 이유: 시안이 둘을 다르게 그렸다.
 * disabled 는 회색 면이고 pending 은 색을 유지한 채 스피너를 돈다.
 * 같게 그리면 "지금 처리 중"과 "누를 수 없음"을 구분할 수 없다.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';
type Size = 'sm' | 'md' | 'lg';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  block = false,
  pending = false,
  className,
  disabled,
  ...rest
}: {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  pending?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & { className?: string }) {
  const classes = [
    'btn',
    `btn--${size}`,
    `btn--${variant}`,
    block ? 'btn--block' : null,
    pending ? 'btn--pending' : null,
    className ?? null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      // 처리 중에는 두 번 눌리지 않게 막는다. 사람은 반응이 없으면 반드시 다시 누른다.
      disabled={disabled || pending}
      className={classes}
      // 스크린리더에게도 "지금 바쁘다"를 알린다. 시각적 스피너만으로는 전달되지 않는다.
      aria-busy={pending || undefined}
      {...rest}
    >
      {pending && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
