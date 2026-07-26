'use client';

import type { ReactNode } from 'react';

/**
 * 폼 공통 부품.
 *
 * 화면마다 인풋 스타일을 다시 쓰지 않기 위해 여기 모은다.
 * 시안 검수에서 하드코딩된 색이 100곳 넘게 나온 원인이 이걸 안 한 것이었다.
 *
 * **크기도 여기서 정하지 않는다.** 라벨 14/700, 힌트 13 같은 값은 `components.css` 의
 * `.field*` 에 있다 — 화면이 숫자를 적기 시작하면 같은 폼이 화면마다 달라진다.
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
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {/* 힌트와 에러가 같은 자리를 쓴다. 에러가 나면 힌트는 할 일이 끝났다. */}
      {error ? (
        <span role="alert" className="field__error">
          {error}
        </span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </label>
  );
}

export function SubmitButton({
  children,
  pending,
  disabled,
}: {
  children: ReactNode;
  pending: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      // 처리 중에는 두 번 눌리지 않게 막는다. 사람은 반응이 없으면 반드시 다시 누른다.
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={`btn btn--primary btn--lg btn--block${pending ? ' btn--pending' : ''}`}
    >
      {pending && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** 서버가 준 메시지를 그대로 보여준다. 화면이 문구를 다시 짓지 않는다. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="form-error">
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
    <main className="auth">
      <h1 className="t-h1" style={{ marginBottom: 'var(--space-2)' }}>
        {title}
      </h1>
      <p className="auth__sub">{sub}</p>
      {children}
    </main>
  );
}
