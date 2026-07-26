import type { MetadataRoute } from 'next';

import { ALLOW_INDEXING } from '../lib/env';

/**
 * robots.txt.
 *
 * 메타 태그와 **둘 다** 둔다. 하나로 충분해 보이지만 역할이 다르다 —
 * `robots.txt` 는 크롤러가 페이지를 받아가기 전에 읽고, 메타 태그는 받아간 뒤에 읽는다.
 * 링크가 외부에 먼저 퍼진 경우처럼 한쪽만으로는 새는 경로가 있다.
 *
 * 기본값은 전면 차단이다. 근거는 lib/env.ts 의 ALLOW_INDEXING 주석에 있다.
 */
export default function robots(): MetadataRoute.Robots {
  if (!ALLOW_INDEXING) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  /*
   * 열더라도 로그인 구역은 계속 막는다. 의뢰 사진은 고객이 인터넷에서 가져온 남의
   * 저작물일 확률이 높고, 저작권 리스크의 본질이 "공개 게시 + 검색 색인"이다.
   * 근거: brain/10-제품/리스크 - 레퍼런스 사진 저작권.md
   */
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/requests/',
        '/contacts/',
        '/portfolios/',
        '/pro/',
        '/admin/',
        '/onboarding',
        '/login',
        '/signup',
      ],
    },
  };
}
