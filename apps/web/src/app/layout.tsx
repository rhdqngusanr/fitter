import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SiteHeader } from '../components/SiteHeader';
import { SessionProvider } from '../lib/session';

import '../styles/tokens.css';

export const metadata: Metadata = {
  title: { default: 'Fitter', template: '%s · Fitter' },
  description: '사진으로 시공자를 직접 고르는 반셀프 인테리어 매칭',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {/*
          세션은 최상위에 둔다. 공개 화면(갤러리)도 로그인 여부에 따라 상단 바가 바뀌고,
          여기서만 감싸면 새로고침 복원이 앱 전체에서 한 번만 돈다.
        */}
        <SessionProvider>
          <SiteHeader />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
