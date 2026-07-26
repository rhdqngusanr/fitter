'use client';

import type { CSSProperties, ReactNode } from 'react';

/**
 * 폼 공통 부품.
 *
 * 화면마다 인풋 스타일을 다시 쓰지 않기 위해 여기 모은다.
 * 시안 검수에서 하드코딩된 색이 100곳 넘게 나온 원인이 이걸 안 한 것이었다.
 */

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 'var(--space-5)' }}>
      <span style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
        {label}
      </span>
      {children}
      {/* 힌트와 에러가 같은 자리를 쓴다. 에러가 나면 힌트는 할 일이 끝났다. */}
      {error ? (
        <span
          role="alert"
          style={{
            display: 'block',
            marginTop: 'var(--space-2)',
            fontSize: 13,
            color: 'var(--color-danger)',
          }}
        >
          {error}
        </span>
      ) : (
        hint && (
          <span
            style={{
              display: 'block',
              marginTop: 'var(--space-2)',
              fontSize: 13,
              color: 'var(--color-text-tertiary)',
            }}
          >
            {hint}
          </span>
        )
      )}
    </label>
  );
}

/* iOS는 16px 미만 인풋에 포커스하면 화면을 확대한다. 그래서 여기서 16px을 고정한다. */
export const inputStyle: CSSProperties = {
  width: '100%',
  height: 48,
  padding: '0 var(--space-4)',
  fontSize: 16,
  fontFamily: 'inherit',
  color: 'var(--color-text-primary)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 'var(--radius-md)',
};

export function SubmitButton({
  children,
  pending,
  disabled,
}: {
  children: ReactNode;
  pending: boolean;
  disabled?: boolean;
}) {
  const off = pending || disabled;
  return (
    <button
      type="submit"
      disabled={off}
      style={{
        width: '100%',
        height: 48,
        borderRadius: 'var(--radius-md)',
        border: 'none',
        fontSize: 16,
        fontWeight: 600,
        fontFamily: 'inherit',
        color: 'var(--color-text-inverse)',
        background: off ? 'var(--color-primary-300)' : 'var(--color-primary-500)',
        cursor: off ? 'default' : 'pointer',
      }}
    >
      {/* 처리 중에도 버튼 문구를 바꿔준다. 아무 반응이 없으면 사람은 두 번 누른다. */}
      {pending ? '처리 중…' : children}
    </button>
  );
}

/** 서버가 준 메시지를 그대로 보여준다. 화면이 문구를 다시 짓지 않는다. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      style={{
        margin: '0 0 var(--space-5)',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--color-danger-bg)',
        color: 'var(--color-danger)',
        borderRadius: 'var(--radius-md)',
        fontSize: 14,
      }}
    >
      {message}
    </p>
  );
}

export function AuthShell({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <main
      style={{
        maxWidth: 420,
        margin: '0 auto',
        padding: 'var(--space-16) var(--space-4)',
      }}
    >
      <h1 style={{ fontSize: 26, margin: '0 0 var(--space-2)' }}>{title}</h1>
      <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 var(--space-8)' }}>{sub}</p>
      {children}
    </main>
  );
}
