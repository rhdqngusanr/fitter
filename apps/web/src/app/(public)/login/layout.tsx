import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * 로그인은 비로그인이 닿아야 하므로 (public) 에 있지만 **색인 대상은 아니다.**
 *
 * 색인을 열더라도 여기는 계속 닫는다. 검색으로 데려올 가치가 있는 건 시공 사례이지
 * 로그인 폼이 아니고, robots.txt 도 같은 경로를 막고 있다 — 두 신호가 어긋나면
 * 나중에 어느 쪽이 진짜인지 아무도 모르게 된다.
 *
 * 페이지가 'use client' 라 metadata 를 직접 달 수 없어 레이아웃으로 감싼다.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
