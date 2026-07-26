'use client';

import { usePathname } from 'next/navigation';

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
  const pathname = usePathname();

  /*
   * 관리자 콘솔에는 푸터를 두지 않는다. 통신판매중개자 고지는 **사용자에게** 하는
   * 것이고, 운영 화면은 표가 화면을 꽉 채우는 게 목적이다.
   */
  if (pathname.startsWith('/admin')) return null;

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        {/*
          로고와 고지가 한 덩어리다. 시안의 데스크톱 푸터는 이 덩어리를 왼쪽에,
          약관 링크를 오른쪽에 두는 2단이라 감싸는 요소가 있어야 한다.
        */}
        <div className="site-footer__brand">
          <span className="site-footer__logo">Fitter</span>

          <p className="site-footer__notice">
            Fitter는 통신판매중개자이며 시공 계약의 당사자가 아닙니다. 시공 책임은 각 시공자에게
            있습니다.
          </p>
        </div>

        <nav aria-label="약관" className="site-footer__links">
          {/* 시안의 푸터 첫 항목이다. 헤더와 같은 앵커로 보낸다. */}
          <a href="/#how">이용 방법</a>
          <a href="/terms">이용약관</a>
          <a href="/privacy">개인정보처리방침</a>
          <a href="/support">문의</a>
        </nav>
      </div>
    </footer>
  );
}
