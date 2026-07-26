'use client';

import { usePathname } from 'next/navigation';

import { useSession } from '../lib/session';

import { Avatar } from './ui/Avatar';

/**
 * 상단 바.
 *
 * **정본은 `design/G-01 랜딩.dc.html` 의 헤더다** — 시안 8개가 전부 같은 헤더를 그린다.
 * 데스크톱 68px · 좌우 40px, 모바일 56px · 좌우 16px. 로고 다음에 주요 내비가 오고,
 * 오른쪽은 비로그인이면 `로그인` + `시작하기`, 로그인이면 진행 건수 + 아바타다.
 *
 * 전에는 이 헤더가 시안과 달랐다. 내비 항목이 `시공 사례 · 문의 · 내 의뢰` 였는데
 * 시안은 `시공 사진 · 시공자 찾기 · 이용 방법` 이다. 차이가 단어 선택 문제로 보이지만
 * 그렇지 않다 — **시안의 내비는 "무엇을 볼 수 있는가"이고 구현의 내비는 "내 것 관리"였다.**
 * 처음 온 사람에게 `내 의뢰` 는 누를 이유가 없는 메뉴다.
 *
 * 복원이 끝나기 전에는 오른쪽을 그리지 않는다 — 로그인한 사람에게 "로그인" 버튼이
 * 한 번 깜빡였다가 사라지는 게 제일 나쁘다.
 */

/*
 * 주요 내비.
 *
 * `시공자 찾기`(C-06)는 그 화면이 생기면 켜기로 했고, 2026-07-26 에 켰다.
 *
 * 시안의 세 번째 항목 `이용 방법` 은 아직 없다. 해당 시안도 화면도 없어서
 * 만들면 내가 지어내는 것이 된다 — brain/00-허브/열린 질문.md Q8 에 올렸다.
 * **없는 화면으로 링크를 걸어두지 않는다.** 404 는 메뉴가 없는 것보다 나쁘다.
 */
const NAV = [
  { href: '/gallery', label: '시공 사진' },
  { href: '/pros', label: '시공자 찾기' },
];

export function SiteHeader() {
  const { user, loading, logout } = useSession();
  const pathname = usePathname();

  return (
    <>
      {/*
        본문 바로가기. 키보드만 쓰는 사람은 페이지를 열 때마다 상단 메뉴를 전부
        지나야 본문에 닿는다. 화면에서는 숨겨두고 탭으로 포커스가 오면 나타난다 —
        `display:none` 이면 포커스도 못 받으므로 화면 밖으로 밀어두는 방식을 쓴다.
      */}
      <a href="#main" className="skip-link">
        본문 바로가기
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <div className="site-header__left">
            <a href="/" className="site-header__logo">
              Fitter
            </a>
            <nav aria-label="주요" className="site-header__nav">
              {NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className="site-header__link"
                    // 현재 위치를 색과 굵기만으로 알리지 않는다. 시안이 primary-500/700 으로 그린 그 상태다.
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
          </div>

          <div className="site-header__right">
            {loading ? null : user ? (
              <>
                {/*
                  시안은 여기에 `내 의뢰 2건` 처럼 **할 일의 개수**를 놓는다. 이름만 띄우면
                  헤더가 아무 정보도 주지 않는다. 역할에 따라 갈 곳이 다르다.
                */}
                {user.profileType === 'CUSTOMER' && (
                  <a href="/requests/mine" className="site-header__mine">
                    내 의뢰
                  </a>
                )}
                {user.profileType === 'PRO' && (
                  <>
                    {/*
                      시공자에게는 일감 찾기가 첫 메뉴다 — 시안(P-04)의 시공자 내비가
                      `의뢰 찾기 · 내 포트폴리오 · 컨택` 순이다. 이 화면이 없어서
                      서비스가 한쪽으로만 돌고 있었다.
                    */}
                    <a href="/jobs" className="site-header__mine">
                      의뢰 찾기
                    </a>
                    <a href="/portfolios/mine" className="site-header__mine">
                      내 사례
                    </a>
                    {/*
                      P-01 의 데스크톱 내비가 `받은 의뢰 · 내 포트폴리오 · 프로필` 셋이다.
                      프로필로 돌아갈 길이 없으면 한 번 저장한 뒤로는 고칠 방법이 없다.
                    */}
                    <a href="/pro/profile" className="site-header__mine">
                      프로필
                    </a>
                  </>
                )}
                <a href="/contacts" className="site-header__mine">
                  문의
                </a>
                <span className="site-header__me">
                  <Avatar name={user.nickname} size={36} />
                  <span className="site-header__nickname">{user.nickname}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="btn btn--ghost btn--sm site-header__logout"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <a href="/login" className="btn btn--ghost btn--md site-header__login">
                  로그인
                </a>
                <a href="/signup" className="btn btn--primary btn--md">
                  시작하기
                </a>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
