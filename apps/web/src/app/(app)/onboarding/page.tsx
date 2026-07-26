'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { FormError } from '../../../components/form';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api';
import { useSession } from '../../../lib/session';

/**
 * 역할 선택 온보딩 (G-03).
 *
 * 계정당 역할은 하나다([[열린 질문]] Q2 해결). **되돌리기 어려운 선택이므로
 * 고르기 전에 무슨 일이 벌어지는지 다 말한다** — 각 역할이 뭘 하게 되는지 세 줄,
 * 바로 다음에 어떤 화면으로 가는지, 그리고 시공자는 승인 심사가 있다는 것까지.
 *
 * 카드 두 장 외에 아무것도 두지 않는다. 여기서 고민이 길어지면 이탈한다.
 *
 * 근거: design/G-03 역할 선택 온보딩.dc.html · brain/50-결정/ADR-002 - 인증과 권한 모델.md
 */
const CHOICES = [
  {
    type: 'CUSTOMER' as const,
    title: '고객으로 시작',
    subtitle: '내 집을 고치려고 왔습니다',
    bullets: [
      '원하는 사진을 올려 의뢰를 등록한다',
      '시공자 포트폴리오를 보고 직접 문의한다',
      '받은 제안을 비교해 한 명을 고른다',
    ],
    next: '다음 화면: 의뢰 등록 (사진 3장이면 3분)',
    caution: null,
  },
  {
    type: 'PRO' as const,
    title: '시공자로 시작',
    subtitle: '시공 일감을 받으려고 왔습니다',
    bullets: [
      '내 시공 사진을 포트폴리오로 올린다',
      '조건에 맞는 의뢰를 찾아 제안한다',
      '고객 문의를 받고 수락하면 연락한다',
    ],
    next: '다음 화면: 프로필 등록 → 승인 심사',
    /* 승인 게이트를 고르기 전에 말한다. 고른 뒤에 알면 속았다고 느낀다. */
    caution: '사업자등록증 또는 시공 경력 확인이 필요합니다. 승인은 보통 1영업일.',
  },
];

export default function OnboardingPage() {
  /* useSearchParams 를 쓰는 부분은 Suspense 안에 있어야 정적 셸을 먼저 내보낼 수 있다. */
  return (
    <Suspense fallback={null}>
      <RolePicker />
    </Suspense>
  );
}

function RolePicker() {
  const { user, loading, selectProfile } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [picked, setPicked] = useState<'CUSTOMER' | 'PRO' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const raw = params.get('next') ?? '/';
  const next = /^\/(?!\/)/.test(raw) ? raw : '/';

  /*
   * 이 화면을 떠나는 모든 경로가 여기 하나에 모여 있다.
   *
   * 역할 선택 직후에도 이 훅이 돈다(`user.profileType` 이 채워지므로).
   * 그래서 confirm 쪽에서 따로 이동시키면 이 훅이 그걸 덮어쓴다 —
   * 실제로 시공자를 고른 사람이 포트폴리오 등록이 아니라 홈으로 튕겼다.
   * 이동은 한 곳에서만 한다.
   */
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/onboarding')}`);
      return;
    }
    if (user.profileType) {
      /* 카드에 적어둔 "다음 화면"과 같은 곳으로 보낸다. 말한 것과 다른 데로 가면 안 된다. */
      const landing = user.profileType === 'PRO' ? '/portfolios/new' : '/requests/new';
      /*
       * **`next` 를 그대로 따르면 방금 고른 역할이 못 가는 곳으로 보낼 수 있다.**
       * `/portfolios/new` 에서 튕겨온 사람이 고객을 고르면 다시 거기로 가고, 그 화면의
       * 역할 가드가 또 홈으로 튕긴다 — 역할을 골랐는데 아무 데도 도착하지 못한다.
       * 브라우저에서 실제로 그렇게 됐다. 역할에 안 맞는 `next` 는 버리고 착지점으로 간다.
       */
      const mismatched =
        (user.profileType === 'CUSTOMER' && next.startsWith('/portfolios')) ||
        (user.profileType === 'PRO' && next.startsWith('/requests'));
      router.replace(next === '/' || mismatched ? landing : next);
    }
  }, [loading, user, next, router]);

  if (loading || !user || user.profileType) return null;

  async function confirm() {
    if (!picked) return;
    setError(null);
    setPending(true);
    try {
      /* 저장만 한다. 이동은 위의 useEffect 가 맡는다 — 두 곳에서 하면 서로 덮어쓴다. */
      await selectProfile(picked);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '역할을 저장하지 못했습니다.');
      setPending(false);
    }
  }

  /*
   * 보호된 화면에서 튕겨 온 경우다(시안의 "이탈 후 재진입").
   * 역할이 없으면 어떤 경로로 들어와도 여기로 되돌리는데, 이유를 안 말하면
   * 사용자는 자기가 왜 여기 있는지 모른다. 강제하되 이유는 설명한다.
   */
  const forced = raw !== '/';

  const cta = (
    <Button
      variant="primary"
      size="lg"
      className="onboard__cta"
      pending={pending}
      disabled={!picked}
      onClick={() => void confirm()}
    >
      {picked ? '이 역할로 시작하기' : '역할을 하나 골라주세요'}
    </Button>
  );

  return (
    <>
      <main className="onboard">
        <div className="onboard__head">
          {forced && <span className="onboard__forced">이 단계를 마쳐야 다음으로 넘어갑니다</span>}
          <h1 className="onboard__h1">어느 쪽으로 시작하시겠어요?</h1>
          <p className="onboard__lead">
            고른 역할에 맞춰 첫 화면과 메뉴가 달라집니다. 계정당 하나만 고를 수 있습니다.
          </p>
        </div>

        <FormError message={error} />

        {/* 라디오 그룹이다. 둘 중 하나만 고를 수 있다는 걸 스크린리더도 알아야 한다. */}
        <div role="radiogroup" aria-label="역할" className="onboard__cards">
          {CHOICES.map((choice) => (
            <button
              key={choice.type}
              type="button"
              role="radio"
              aria-checked={picked === choice.type}
              onClick={() => setPicked(choice.type)}
              className="role-card"
            >
              <span className="role-card__head">
                <span className="role-card__title">{choice.title}</span>
                {/* 라디오 점. 눌린 게 뭔지 색만으로 알리지 않는다 — 색각 이상에서도 보여야 한다. */}
                <span className="role-card__dot" aria-hidden="true" />
              </span>

              <span className="role-card__lead">{choice.subtitle}</span>

              <span className="role-card__does">
                {choice.bullets.map((bullet) => (
                  <span key={bullet} className="role-card__bullet">
                    {bullet}
                  </span>
                ))}
              </span>

              {/* 고르기 전에 다음 화면을 알려준다. 뭘 하게 될지 알고 고르는 게 낫다. */}
              <span className="role-card__next">{choice.next}</span>

              {choice.caution && <span className="role-card__gate">{choice.caution}</span>}
            </button>
          ))}
        </div>

        {/*
          되돌릴 수 없다는 사실. **모바일은 상자로 본문에**, 데스크톱은 확정 버튼
          아래 한 문장으로 둔다(시안 그대로). 어느 쪽이든 결정 직전에 보여야 한다 —
          설명 문단에 섞어두면 안 읽는다.
        */}
        <div className="onboard__warnbox">
          <strong>한 번 고르면 스스로 바꿀 수 없습니다</strong>
          <span>잘못 고르셨다면 설정에서 전환을 요청하세요. 확인 후 하루 안에 바꿔드립니다.</span>
        </div>

        <div className="onboard__foot">
          {cta}
          <span className="onboard__note">
            한 번 고르면 스스로 바꿀 수 없습니다. 잘못 고르셨다면 설정에서 전환을 요청하세요 — 확인
            후 하루 안에 바꿔드립니다.
          </span>
        </div>
      </main>

      {/* 모바일 하단 고정. 시안은 확정 버튼을 항상 손에 닿는 곳에 둔다. */}
      <div className="shell">
        <div className="sticky-cta">
          {/* 버튼이 왜 잠겼는지 말한다. 잠긴 이유를 모르면 사람은 화면을 떠난다. */}
          {!picked && <span className="onboard__hint">역할을 하나 골라주세요</span>}
          <Button
            variant="primary"
            size="lg"
            block
            pending={pending}
            disabled={!picked}
            onClick={() => void confirm()}
          >
            {picked ? '이 역할로 시작하기' : '역할을 하나 골라주세요'}
          </Button>
        </div>
      </div>
    </>
  );
}
