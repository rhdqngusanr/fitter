import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * 가입도 로그인과 같다 — (public) 에 있지만 색인하지 않는다.
 * 근거는 login/layout.tsx 주석에 있다.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SignupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
