import type { ReactNode } from 'react';

/**
 * 페이지 폭.
 *
 * **시안의 프레임은 모바일 390 / 데스크톱 1280 둘뿐이고 모든 섹션이 좌우 40px(모바일 16px)
 * 패딩을 쓴다.** 구현은 화면마다 max-width 를 680 · 720 · 880 · 1120 으로 제각각
 * 정하고 있었다. 폭이 화면마다 다르면 화면을 넘어갈 때마다 본문이 좌우로 흔들린다.
 *
 * 세 종류만 있다.
 * - `full` — 시안의 데스크톱 프레임 그대로(1280). 랜딩·갤러리처럼 그리드가 넓게 깔리는 화면.
 * - `content` — 1000. 목록·상세. 시안이 이 화면들에서 쓰는 값이다.
 * - `form` — 680. 한 줄이 길어지면 읽기 힘든 폼.
 *
 * 근거: design/Fitter 디자인 시스템 v1.dc.html 푸터("모바일 390px 우선, 데스크톱 1280px 확장")
 */
export function PageShell({
  children,
  width = 'content',
  as = 'div',
}: {
  children: ReactNode;
  width?: 'full' | 'content' | 'form';
  as?: 'div' | 'main' | 'section' | 'header' | 'footer';
}) {
  const Tag = as;
  const modifier = width === 'full' ? '' : ` shell--${width}`;
  return <Tag className={`shell${modifier}`}>{children}</Tag>;
}

/**
 * 화면 제목 줄.
 *
 * 제목 크기를 화면마다 다시 정하지 않기 위해 여기 둔다. 시안의 페이지 제목은
 * 전부 h1(28/24px) 이고 그 아래 보조 설명이 secondary 로 붙는다.
 */
export function PageTitle({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        flexWrap: 'wrap',
        marginBottom: 'var(--space-6)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', minWidth: 0 }}>
        <h1 className="t-h1">{title}</h1>
        {sub && (
          <p className="t-body" style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            {sub}
          </p>
        )}
      </div>
      {actions}
    </div>
  );
}
