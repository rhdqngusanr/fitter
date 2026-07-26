'use client';

import { useSession } from '../lib/session';

/**
 * 상단 바.
 *
 * 로그인 상태에 따라 오른쪽이 바뀐다. 복원이 끝나기 전에는 아무것도 그리지 않는다 —
 * 로그인한 사람에게 "로그인" 버튼이 한 번 깜빡였다가 사라지는 게 제일 나쁘다.
 */
export function SiteHeader() {
  const { user, loading, logout } = useSession();

  return (
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
        <a href="/" style={{ fontWeight: 700, fontSize: 20, color: 'var(--color-primary-600)' }}>
          Fitter
        </a>
        <a href="/gallery" style={{ color: 'var(--color-text-secondary)' }}>
          시공 사례
        </a>
        {/* 로그인 전용 메뉴. 비로그인에게 보여주면 누를 때마다 로그인으로 튕긴다. */}
        {user && (
          <>
            <a href="/contacts" style={{ color: 'var(--color-text-secondary)' }}>
              문의
            </a>
            {user.profileType === 'CUSTOMER' && (
              <a href="/requests/mine" style={{ color: 'var(--color-text-secondary)' }}>
                내 의뢰
              </a>
            )}
          </>
        )}

        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
          }}
        >
          {loading ? null : user ? (
            <>
              <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
                {user.nickname}
              </span>
              <button
                type="button"
                onClick={() => void logout()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-tertiary)',
                  fontSize: 14,
                  cursor: 'pointer',
                  padding: '0 var(--space-2)',
                }}
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <a href="/login" style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
                로그인
              </a>
              <a
                href="/signup"
                role="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 36,
                  padding: '0 var(--space-5)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-primary-500)',
                  color: 'var(--color-text-inverse)',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                시작하기
              </a>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
