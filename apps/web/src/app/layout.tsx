import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '../styles/tokens.css';

export const metadata: Metadata = {
  title: { default: 'Fitter', template: '%s · Fitter' },
  description: '사진으로 시공자를 직접 고르는 반셀프 인테리어 매칭',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header
          style={{
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <nav
            style={{
              maxWidth: 1120,
              margin: '0 auto',
              padding: '0 var(--space-4)',
              height: 60,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-6)',
            }}
          >
            <a
              href="/"
              style={{ fontWeight: 700, fontSize: 20, color: 'var(--color-primary-600)' }}
            >
              Fitter
            </a>
            <a href="/gallery" style={{ color: 'var(--color-text-secondary)' }}>
              시공 사례
            </a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
