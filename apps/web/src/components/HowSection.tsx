'use client';

import { useState } from 'react';

/**
 * 이용 방법 (G-01 `#how`).
 *
 * **별도 화면을 만들지 않는다는 결정의 구현이다.** 헤더의 `이용 방법` 은 이 섹션으로
 * 스크롤하는 앵커다. 화면 목록은 21개 그대로다. → [[열린 질문]] Q8
 *
 * 역할 토글로 3단계·FAQ·CTA 가 함께 바뀐다. 고객과 시공자가 하는 일이 다르므로
 * 한쪽 설명만 두면 나머지 절반은 "나한테 하는 말이 아니다"라고 읽는다.
 *
 * 클라이언트 컴포넌트인 이유는 토글 하나 때문이다. 랜딩의 나머지는 SSR 이다 —
 * 이 섹션만 떼어내서 색인되는 본문을 유지한다.
 *
 * 시안: design/G-01 랜딩.dc.html
 */

interface Step {
  title: string;
  body: string;
}

interface Faq {
  q: string;
  a: string;
}

interface RoleContent {
  label: string;
  title: string;
  sub: string;
  steps: Step[];
  faq: Faq[];
  cta: { label: string; href: string };
  alt: { label: string; href: string };
}

/*
 * 카피의 사실 확인.
 *
 * 시안 카피 중 **지킬 수 없는 약속 셋을 고쳤다.**
 *
 * 1. "사업자등록증과 자격 서류를 올리면 영업일 1~2일 내 확인됩니다"
 *    → 서류 업로드가 없다(P-01 에서 확인). 심사 기한을 정한 곳도 없다.
 * 2. "응답 속도와 수락률이 목록 노출에 반영됩니다"
 *    → `/pros` 정렬은 등록순이다. 그런 가중치는 없다.
 * 3. "공종별로 의뢰를 나눠 올리면 됩니다"
 *    → 한 의뢰에 공종을 여러 개 담을 수 있다(`workCategoryCodes` 는 배열이다).
 *
 * 랜딩은 서비스가 처음 하는 말이다. 여기서 못 지킬 말을 하면 나머지가 다 의심받는다.
 */
const CONTENT: Record<'customer' | 'pro', RoleContent> = {
  customer: {
    label: '고객으로',
    title: '3단계로 끝납니다',
    /*
     * 시안은 "견적서를 읽을 줄 몰라도 됩니다"였다. **`견적` 은 금지어다** —
     * MVP 에서 확정되는 금액은 없고, 그 단어가 "여기서 금액이 정해진다"는
     * 기대를 만든다. `pnpm qc` 가 잡았다. → brain/20-도메인/도메인 용어집.md
     */
    sub: '어려운 용어나 서류는 없습니다. 원하는 사진과 집 정보만 있으면 의뢰가 완성됩니다.',
    steps: [
      {
        title: '사진을 올린다',
        body: '마음에 든 사진 3~10장이면 충분합니다. 인테리어 용어는 몰라도 됩니다.',
      },
      {
        title: '제안을 받는다',
        body: '조건에 맞는 공종 시공자가 자기 포트폴리오와 함께 제안을 보냅니다.',
      },
      {
        title: '직접 고른다',
        body: '수락하면 연락처가 열립니다. 비용은 시공자와 직접 정하고, 중간 마진은 없습니다.',
      },
    ],
    faq: [
      {
        q: '비용은 얼마나 드나요?',
        a: 'Fitter는 수수료를 받지 않습니다. 시공비는 시공자에게 직접 지불합니다.',
      },
      {
        q: '연락처가 바로 공개되나요?',
        a: '아니요. 문의를 시공자가 수락한 뒤에만 양쪽 연락처가 열립니다.',
      },
      {
        q: '여러 공종을 한 번에 맡길 수 있나요?',
        a: '의뢰 하나에 공종을 여러 개 고를 수 있습니다. 도배와 장판을 같이 올리면 둘 다 하는 시공자에게 갑니다.',
      },
    ],
    cta: { label: '사진 올리고 의뢰 등록', href: '/requests/new' },
    alt: { label: '시공 사진 먼저 둘러보기', href: '/gallery' },
  },
  pro: {
    label: '시공자로',
    title: '제안까지 3단계',
    sub: '영업 대신 시공 사진으로 증명합니다. 조건에 맞는 의뢰만 골라 제안하세요.',
    steps: [
      {
        title: '프로필을 채운다',
        body: '활동명·공종·활동 지역만 채우면 의뢰 목록이 열립니다. 사업자등록번호를 넣으면 승인 심사가 시작됩니다.',
      },
      {
        title: '포트폴리오를 올린다',
        body: '시공 전후 사진과 자재·기간을 남기면 고객이 그것만 보고 판단합니다.',
      },
      {
        title: '의뢰에 제안한다',
        body: '지역·공종이 맞는 의뢰가 목록에 뜹니다. 수락되면 연락처가 열립니다.',
      },
    ],
    faq: [
      {
        q: '가입에 비용이 드나요?',
        a: '등록과 제안 모두 무료입니다. 노출 대가를 받지 않습니다.',
      },
      {
        q: '승인은 어떻게 받나요?',
        a: '프로필에 사업자등록번호를 넣으면 승인 대기로 들어갑니다. 승인 전에도 프로필과 포트폴리오를 만들 수 있고, 승인되면 사례가 공개되며 시공자 목록에 뜹니다.',
      },
      {
        q: '제안은 몇 건까지 가능한가요?',
        /*
         * 실제 규칙을 확인하고 썼다. 부분 유니크 인덱스가 막는 건
         * `(requester, receiver) WHERE status='REQUESTED'` 다 — **같은 상대에게
         * 답을 기다리는 요청이 하나뿐**이라는 뜻이고, 의뢰 단위가 아니다.
         * 처음에 "한 의뢰에 두 번 제안 불가"라고 썼는데 그건 사실이 아니었다.
         */
        a: '제한은 없습니다. 다만 같은 고객에게 답을 기다리는 제안이 있으면 새로 보낼 수 없습니다.',
      },
    ],
    cta: { label: '시공자로 시작하기', href: '/signup' },
    alt: { label: '올라온 의뢰 살펴보기', href: '/jobs' },
  },
};

export function HowSection() {
  const [role, setRole] = useState<'customer' | 'pro'>('customer');
  const how = CONTENT[role];

  return (
    <section className="how" id="how">
      <div className="shell">
        <div className="how__head">
          <div className="how__intro">
            <span className="how__eyebrow">이용 방법</span>
            <h2 className="landing-h2">{how.title}</h2>
            <p className="how__sub">{how.sub}</p>
          </div>
          {/*
            역할 토글. `aria-pressed` 로 상태를 알린다 — 탭처럼 보이지만 라우팅이
            아니라 같은 섹션의 내용을 바꾸는 것이므로 tablist 로 만들지 않았다.
          */}
          <div className="how__tabs">
            {(['customer', 'pro'] as const).map((key) => (
              <button
                key={key}
                type="button"
                className="how__tab"
                aria-pressed={role === key}
                onClick={() => setRole(key)}
              >
                {CONTENT[key].label}
              </button>
            ))}
          </div>
        </div>

        <ol className="landing-steps">
          {how.steps.map((step, index) => (
            <li key={step.title} className="landing-step">
              <span className="landing-step__n" aria-hidden="true">
                {index + 1}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <strong className="landing-step__title">{step.title}</strong>
                <span className="landing-step__body">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="how__faq">
          {how.faq.map((item) => (
            <div key={item.q} className="how__faq-item">
              <strong className="how__faq-q">{item.q}</strong>
              <span className="how__faq-a">{item.a}</span>
            </div>
          ))}
        </div>

        <div className="how__cta">
          <a className="btn btn--primary btn--lg" href={how.cta.href}>
            {how.cta.label}
          </a>
          <a className="btn btn--secondary btn--lg" href={how.alt.href}>
            {how.alt.label}
          </a>
        </div>
      </div>
    </section>
  );
}
