'use client';

import { useEffect, useState } from 'react';

import { useSession } from '../lib/session';

/**
 * 로그인한 사람이 랜딩에 다시 온 경우.
 *
 * **시안(G-01)의 5상태 중 "로그인 상태"가 이것이다** — "마케팅 히어로 위에 지금 처리할 일
 * 배너를 얹는다." 구현에는 이 상태가 통째로 없어서, 이미 가입한 사람이 랜딩에 오면
 * 처음 온 사람과 똑같은 화면을 봤다.
 *
 * 배너의 내용은 **개수**다. 이름만 띄우면 배너가 아무 일도 하지 않는다.
 * 그래서 받은 문의 중 아직 답하지 않은 것(REQUESTED)을 세어서 보여준다.
 *
 * 랜딩은 SSR 인데 이 조각만 클라이언트인 이유: 액세스 토큰이 브라우저 메모리에만 살아서
 * 서버는 누가 보고 있는지 알 방법이 없다.
 */
export function WelcomeBanner() {
  const { user, loading, authFetch } = useSession();
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    /*
     * 실패하면 조용히 넘긴다. 이 배너는 부가 정보이고, 여기서 에러를 띄우면
     * 랜딩에 온 사람이 서비스가 고장난 줄 안다.
     */
    void authFetch<{ items: unknown[] }>('/contacts?box=received&status=REQUESTED')
      .then((res) => {
        if (alive) setPending(res.items.length);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, authFetch]);

  // 복원 중이거나 비로그인이면 아무것도 그리지 않는다. 깜빡이는 배너가 제일 나쁘다.
  if (loading || !user) return null;

  const isPro = user.profileType === 'PRO';
  const mineHref = isPro ? '/portfolios/mine' : '/requests/mine';
  const mineLabel = isPro ? '내 사례 보기' : '내 의뢰 보기';

  return (
    <div className="landing-welcome">
      <span style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <strong className="landing-welcome__title">다시 오셨네요, {user.nickname}님</strong>
        <span className="landing-welcome__body">
          {pending === null ? (
            // 아직 세는 중. 숫자 자리에 0을 먼저 넣으면 잠깐 "없다"고 거짓말을 한다.
            <>받은 문의를 확인하고 있습니다.</>
          ) : pending > 0 ? (
            <>
              답을 기다리는 문의가{' '}
              <strong style={{ color: 'var(--color-text-primary)' }}>{pending}건</strong> 있습니다.
              수락하면 그 자리에서 연락처가 열립니다.
            </>
          ) : (
            <>
              새로 온 문의는 없습니다.{' '}
              {isPro
                ? '사례를 더 올리면 문의가 늘어납니다.'
                : '마음에 드는 사진에서 바로 문의할 수 있습니다.'}
            </>
          )}
        </span>
      </span>
      <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a href={mineHref} className="btn btn--secondary btn--lg">
          {mineLabel}
        </a>
        <a href="/contacts" className="btn btn--primary btn--lg">
          {pending && pending > 0 ? `받은 문의 ${pending}건 보기` : '받은 문의 보기'}
        </a>
      </span>
    </div>
  );
}
