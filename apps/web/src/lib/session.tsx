'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { api, ApiError, type ApiOptions } from './api';

/**
 * 세션.
 *
 * **액세스 토큰은 메모리에만 둔다.** localStorage에 두면 XSS 한 번에 자격이 통째로 넘어간다.
 * 새로고침하면 사라지므로, 뜰 때 `/auth/refresh` 를 한 번 불러 다시 받는다.
 * 리프레시 토큰은 httpOnly 쿠키라 이 코드가 읽지도 못하고 읽을 필요도 없다.
 *
 * 근거: brain/50-결정/ADR-002 - 인증과 권한 모델.md 결정 3
 */

export interface SessionUser {
  id: string;
  email: string;
  nickname: string;
  /** 역할을 아직 안 고른 사용자가 있다. 온보딩으로 보내는 판단 근거다. */
  profileType: 'CUSTOMER' | 'PRO' | 'ADMIN' | null;
}

interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string; nickname: string };
}

interface SessionValue {
  user: SessionUser | null;
  /** 첫 복원이 끝나기 전. 이 동안 "로그인" 버튼을 그리면 로그인한 사람에게 깜빡인다. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: {
    email: string;
    password: string;
    nickname: string;
    agreedToTerms: true;
  }) => Promise<void>;
  logout: () => Promise<void>;
  selectProfile: (type: 'CUSTOMER' | 'PRO') => Promise<void>;
  /** 로그인이 필요한 요청. 401이면 리프레시를 한 번 시도하고 다시 보낸다. */
  authFetch: <T>(path: string, options?: ApiOptions) => Promise<T>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  /*
   * 토큰은 state가 아니라 ref다. 값이 바뀔 때마다 화면을 다시 그릴 이유가 없고,
   * 렌더 사이에 낀 요청이 낡은 토큰을 잡는 것도 막는다.
   */
  const token = useRef<string | null>(null);

  const loadProfile = useCallback(async () => {
    const me = await api<SessionUser>('/me', {
      headers: { Authorization: `Bearer ${token.current}` },
    });
    setUser(me);
  }, []);

  const adopt = useCallback(
    async (res: AuthResponse) => {
      token.current = res.accessToken;
      /* 로그인 응답에는 역할이 없다. 온보딩 여부를 알려면 /me 를 한 번 더 봐야 한다. */
      await loadProfile();
    },
    [loadProfile],
  );

  /* 새로고침 복원. 쿠키가 없으면 그냥 비로그인이고, 에러가 아니다. */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api<AuthResponse>('/auth/refresh', { method: 'POST' });
        if (!alive) return;
        await adopt(res);
      } catch {
        if (alive) setUser(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [adopt]);

  const authFetch = useCallback(async <T,>(path: string, options: ApiOptions = {}): Promise<T> => {
    const send = () =>
      api<T>(path, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${token.current}` },
      });

    try {
      return await send();
    } catch (error) {
      /*
       * 액세스 토큰은 15분이라 사용 중에 만료되는 게 정상이다.
       * 사용자에게 다시 로그인하라고 하지 않고 조용히 갱신한 뒤 한 번만 재시도한다.
       * 두 번 실패하면 진짜 로그아웃이다 — 무한 재시도로 서버를 때리지 않는다.
       */
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      const res = await api<AuthResponse>('/auth/refresh', { method: 'POST' });
      token.current = res.accessToken;
      return await send();
    }
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const res = await api<AuthResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        await adopt(res);
      },
      signup: async (input) => {
        const res = await api<AuthResponse>('/auth/signup', {
          method: 'POST',
          body: JSON.stringify(input),
        });
        await adopt(res);
      },
      logout: async () => {
        /* 서버가 실패해도 이 브라우저에서는 반드시 로그아웃된 상태가 돼야 한다. */
        try {
          await api<void>('/auth/logout', { method: 'POST' });
        } finally {
          token.current = null;
          setUser(null);
        }
      },
      selectProfile: async (type) => {
        await authFetch('/me/profile', { method: 'POST', body: JSON.stringify({ type }) });
        await loadProfile();
      },
      authFetch,
    }),
    [user, loading, adopt, authFetch, loadProfile],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession 은 SessionProvider 안에서만 쓸 수 있습니다.');
  return value;
}
