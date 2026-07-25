import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * 로그인 영역 — 검색엔진에서 제외한다.
 *
 * 의뢰 사진은 고객이 인터넷에서 가져온 남의 저작물일 확률이 높다.
 * 저작권 리스크의 본질은 "공개 게시 + 검색 색인"이므로, 로그인 벽 뒤에 두고 noindex를 건다.
 * 포트폴리오는 열고 의뢰는 닫는 비대칭이 여기서 나온다.
 *
 * 근거: brain/10-제품/리스크 - 레퍼런스 사진 저작권.md · brain/30-설계/화면 목록.md
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
