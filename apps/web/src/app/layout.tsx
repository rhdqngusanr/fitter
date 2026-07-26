import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { SessionProvider } from '../lib/session';

import '../styles/tokens.css';
// 토큰 다음에 온다. 컴포넌트 스타일이 토큰 변수를 쓰기 때문이다.
import '../styles/components.css';

export const metadata: Metadata = {
  title: { default: 'Fitter', template: '%s · Fitter' },
  description: '사진으로 시공자를 직접 고르는 반셀프 인테리어 매칭',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/*
          Pretendard. 시안이 쓰는 것과 같은 CDN·같은 버전이다.
          이걸 안 걸면 토큰에 Pretendard 라고 적어놓고 실제로는 시스템 폰트로 그려진다 —
          자간과 숫자 폭이 달라서 시안과 대조가 안 맞는다.

          preconnect 를 먼저 여는 이유는 폰트가 렌더를 막는 자원이라서다.
          연결을 미리 열어두면 첫 글자가 보이는 시점이 앞당겨진다.
        */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body>
        {/*
          세션은 최상위에 둔다. 공개 화면(갤러리)도 로그인 여부에 따라 상단 바가 바뀌고,
          여기서만 감싸면 새로고침 복원이 앱 전체에서 한 번만 돈다.
        */}
        <SessionProvider>
          <SiteHeader />
          {/*
            건너뛰기 링크의 도착점. 화면마다 <main> 을 따로 두고 있어서 여기서 한 번만 감싼다.
            tabIndex={-1} 이 있어야 브라우저가 스크롤만 하지 않고 포커스까지 옮긴다 —
            포커스가 안 옮겨지면 다음 탭이 다시 헤더로 돌아가서 링크가 무의미해진다.
          */}
          <div id="main" tabIndex={-1}>
            {children}
          </div>
          {/* 통신판매중개자 고지는 법적 요구다. 랜딩에만 두지 않고 모든 화면에 둔다. */}
          <SiteFooter />
        </SessionProvider>
      </body>
    </html>
  );
}
