import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ALLOW_INDEXING } from '../../lib/env';

/**
 * 공개 영역 — 검색엔진에 열 수 있는 유일한 구역이다.
 *
 * 포트폴리오 사진은 시공자 본인이 찍은 자기 작업물이라 공개·색인 권리를 확보할 수 있다.
 * 그리고 여기가 콜드스타트를 뚫을 유일한 유입 통로다.
 * "성북구 24평 도배 시공 사례" 같은 검색어로 들어오게 하는 게 목적이다.
 *
 * **다만 여는 시점은 환경변수가 정한다.** 친구 테스트 데이터가 검색에 잡히면 나중에
 * 지워도 캐시가 남는다. 기본값은 막는 쪽이고, 실제 공개 때 켠다.
 *
 * 근거: brain/30-설계/화면 목록.md — 비로그인 공개 범위 · brain/10-제품/리스크 - 콜드스타트.md ·
 * brain/70-산출물/배포 준비 상태.md — 색인 결정
 */
export const metadata: Metadata = {
  robots: ALLOW_INDEXING ? { index: true, follow: true } : { index: false, follow: false },
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
