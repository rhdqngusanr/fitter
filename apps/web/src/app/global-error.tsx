'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

import '../styles/tokens.css';
import '../styles/components.css';

/**
 * 루트 에러 경계.
 *
 * **이 파일이 없으면 렌더 중에 터진 에러를 아무도 못 본다.** 클라이언트 전역 핸들러는
 * React 가 이미 삼킨 예외를 보지 못하고, 사용자에게는 Next 기본 에러 화면만 남는다.
 * 친구 테스트에서 "그냥 하얗게 떠요"라는 제보를 받고 끝나는 경우가 이것이다.
 *
 * 루트 레이아웃을 통째로 대체하므로 html·body 와 스타일을 직접 들고 있어야 한다.
 * 헤더·푸터는 일부러 두지 않는다 — 그 컴포넌트가 터진 원인일 수 있다.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <main className="shell shell--content" style={{ paddingTop: 96, paddingBottom: 96 }}>
          <h1 className="t-h2">화면을 여는 중에 문제가 생겼습니다</h1>
          <p className="t-body" style={{ color: 'var(--color-text-secondary)', marginTop: 12 }}>
            잠시 후 다시 시도해 주세요. 계속 같은 화면이 나오면 알려주시면 확인하겠습니다.
          </p>
          {/*
            digest 는 서버가 붙인 에러 식별자다. 사용자에게 스택을 보여주지 않으면서
            제보와 Sentry 기록을 이어붙일 수 있는 유일한 끈이라 이것만 노출한다.
          */}
          {error.digest ? (
            <p className="t-caption" style={{ color: 'var(--color-text-tertiary)', marginTop: 8 }}>
              오류 번호 {error.digest}
            </p>
          ) : null}
          {/*
            재시도(reset) 대신 홈으로 보낸다. 루트 경계까지 올라온 에러는 같은 트리를
            다시 그려도 대개 같은 자리에서 다시 터진다 — 누를 때마다 실패하는 버튼이 된다.
          */}
          <a className="btn btn--primary btn--md" href="/" style={{ marginTop: 24 }}>
            처음으로
          </a>
        </main>
      </body>
    </html>
  );
}
