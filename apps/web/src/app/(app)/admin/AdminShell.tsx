'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useSession } from '../../../lib/session';

/**
 * 관리자 콘솔 껍데기 (A-01 · A-02 공통).
 *
 * 좌측 내비에 **화면이 있는 항목만 둔다.** 시안은 `회원 · 의뢰 · 감사 로그` 를 함께
 * 그렸지만 그 셋은 화면도 API 도 없다. 링크를 걸면 404 이고, 회색으로 두면
 * "곧 나온다"는 약속이 된다. 둘 다 하지 않는다.
 *
 * 시안: design/A-01 A-02 관리자.dc.html (1440px 데스크톱 단독)
 */
export function AdminShell({
  active,
  title,
  endpoint,
  searchPlaceholder,
  search,
  onSearch,
  counts,
  children,
}: {
  active: 'approvals' | 'reports';
  title: string;
  endpoint: string;
  searchPlaceholder: string;
  search: string;
  onSearch: (value: string) => void;
  counts: { approvals: number | null; reports: number | null };
  children: ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/admin')}`);
      return;
    }
    /*
     * 역할 가드. 서버도 `@Roles('ADMIN')` 으로 막지만 화면이 먼저 돌려보내야
     * 관리자가 아닌 사람에게 빈 표가 보이지 않는다.
     */
    if (user.profileType !== 'ADMIN') router.replace('/');
  }, [loading, user, router]);

  if (loading || !user || user.profileType !== 'ADMIN') return null;

  const nav = [
    { key: 'approvals' as const, href: '/admin', label: '시공자 승인', count: counts.approvals },
    { key: 'reports' as const, href: '/admin/reports', label: '신고 처리', count: counts.reports },
  ];

  return (
    <div className="adm">
      <aside className="adm__side">
        <span className="adm__brand">
          <span className="adm__brand-name">Fitter</span>
          <span className="adm__brand-sub">ADMIN CONSOLE</span>
        </span>

        <nav className="adm__nav" aria-label="관리자 메뉴">
          {nav.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="adm__nav-item"
              aria-current={item.key === active ? 'page' : undefined}
            >
              <span>{item.label}</span>
              <span className="adm__nav-count">{item.count ?? '—'}</span>
            </Link>
          ))}
        </nav>

        <div className="adm__who">
          <span className="adm__who-name">운영자 · {user.nickname}</span>
          <span className="adm__who-mail">{user.email}</span>
          {/*
            시안은 "모든 조치는 감사 로그에 남습니다"라고 적었지만 **감사 로그가 없다.**
            없는 안전장치를 있다고 말하면 운영자가 그것을 믿고 행동한다.
            지금 남는 건 알림과 상태 컬럼뿐이므로 그것만 말한다.
          */}
          <span className="adm__who-note">
            승인·반려는 시공자에게 알림으로 통보됩니다. 별도 감사 로그는 아직 없습니다.
          </span>
        </div>
      </aside>

      <main className="adm__main">
        <header className="adm__head">
          <div className="adm__title-row">
            <h1 className="adm__h1">{title}</h1>
            <span className="adm__endpoint">{endpoint}</span>
          </div>
          <label className="adm__search">
            <span className="adm__search-icon" aria-hidden="true">
              ⌕
            </span>
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
          </label>
          {/*
            시안의 `CSV 내보내기` 는 없다 — 내보내기 엔드포인트가 없다.
            누르면 아무 일도 안 하는 버튼을 두지 않는다.
          */}
        </header>

        <p className="adm__narrow">
          이 콘솔은 넓은 화면을 기준으로 만들었습니다. 표는 좌우로 스크롤됩니다.
        </p>

        {children}
      </main>
    </div>
  );
}
