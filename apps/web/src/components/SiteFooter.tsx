/**
 * 푸터.
 *
 * **정본은 `design/G-01 랜딩.dc.html` 의 푸터다.** 로고(15px/800) → 통신판매중개자 고지
 * (12px/1.6 tertiary) → 약관 링크 줄(12px) 순서이고 gap 은 8px 다.
 *
 * **통신판매중개자 고지가 여기 있는 이유는 법적 요구이기 때문이다.**
 * Fitter는 연결만 하고 시공 계약의 당사자가 아니다. 이 문장이 없으면
 * 사고가 났을 때 플랫폼이 계약 당사자로 오인될 수 있다.
 *
 * 시안은 이걸 랜딩에만 그렸지만 그건 시안이 랜딩 화면이기 때문이다.
 * 사용자가 어느 화면에서 들어오든 같은 고지를 봐야 하므로 레이아웃에 둔다.
 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text-primary)' }}>
          Fitter
        </span>

        <p
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.6,
            color: 'var(--color-text-tertiary)',
            maxWidth: 640,
          }}
        >
          Fitter는 통신판매중개자이며 시공 계약의 당사자가 아닙니다. 시공 책임은 각 시공자에게
          있습니다.
        </p>

        <nav
          aria-label="약관"
          style={{
            display: 'flex',
            gap: 'var(--space-3)',
            fontSize: 12,
            marginTop: 'var(--space-1)',
          }}
        >
          <a href="/terms">이용약관</a>
          <a href="/privacy">개인정보처리방침</a>
          <a href="/support">문의</a>
        </nav>
      </div>
    </footer>
  );
}
