/**
 * 푸터.
 *
 * **통신판매중개자 고지가 여기 있는 이유는 법적 요구이기 때문이다.**
 * Fitter는 연결만 하고 시공 계약의 당사자가 아니다. 이 문장이 없으면
 * 사고가 났을 때 플랫폼이 계약 당사자로 오인될 수 있다.
 *
 * 랜딩에만 두지 않고 모든 화면에 둔다 — 사용자가 어느 화면에서 들어오든 같은 고지를 본다.
 *
 * 근거: design/G-01 랜딩.dc.html · brain/10-제품/서비스 정의.md
 */
export function SiteFooter() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-bg)',
        marginTop: 'var(--space-16)',
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: 'var(--space-8) var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--color-primary-600)' }}>Fitter</span>

        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.7,
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
            gap: 'var(--space-5)',
            fontSize: 13,
          }}
        >
          <a href="/terms" style={{ color: 'var(--color-text-secondary)' }}>
            이용약관
          </a>
          <a href="/privacy" style={{ color: 'var(--color-text-secondary)' }}>
            개인정보처리방침
          </a>
          <a href="/support" style={{ color: 'var(--color-text-secondary)' }}>
            문의
          </a>
        </nav>
      </div>
    </footer>
  );
}
