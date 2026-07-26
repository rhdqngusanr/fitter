import type { ReactNode } from 'react';

/**
 * 칩.
 *
 * **정본은 시안 04 COMPONENTS 의 "칩 — 공종 필터" 블록이다.** 36px · `--radius-full` ·
 * 14px/600 이고, 선택되면 primary-500 면이 된다.
 *
 * 선택 상태를 `aria-pressed` 로만 표현하고 CSS 가 그 속성을 보고 그린다.
 * 별도 클래스를 두면 눈에 보이는 상태와 스크린리더가 읽는 상태가 갈라질 수 있는데,
 * 이 구조에서는 갈라질 수 없다.
 */
export function Chip({
  children,
  pressed,
  onClick,
}: {
  children: ReactNode;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="chip" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

/** 링크로 동작하는 칩. 갤러리 필터는 URL 에 사는 게 정본이라 링크여야 한다. */
export function ChipLink({
  children,
  pressed,
  href,
}: {
  children: ReactNode;
  pressed: boolean;
  href: string;
}) {
  return (
    <a href={href} className="chip" aria-pressed={pressed} style={{ textDecoration: 'none' }}>
      {children}
    </a>
  );
}

/** 가로 스크롤 줄. 시안은 모바일에서 칩을 줄바꿈하지 않고 옆으로 넘긴다. */
export function ChipRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="chip-row" role="group" aria-label={label}>
      {children}
    </div>
  );
}
