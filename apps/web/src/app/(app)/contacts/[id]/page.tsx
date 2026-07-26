'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { CONTACT_STATUS_LABELS, DECLINE_REASONS, type ContactStatus } from '@fitter/shared';

import { ago, ContactList, statusTone } from '../../../../components/ContactList';
import { Avatar } from '../../../../components/ui/Avatar';
import { Button } from '../../../../components/ui/Button';
import { ApiError } from '../../../../lib/api';
import { useSession } from '../../../../lib/session';

interface ContactDetail {
  id: string;
  status: ContactStatus;
  message: string;
  proposedAmount: number | null;
  proposedAmountNote: string | null;
  declineReason: string | null;
  expiresAt: string | null;
  createdAt: string;
  requesterUserId: string;
  receiverUserId: string;
  counterpart: {
    id: string;
    nickname: string;
    /** ACCEPTED이고 당사자일 때만 이 키가 존재한다. 아니면 키 자체가 없다. */
    phone?: string;
  };
}

/**
 * 컨택 상세 (M-02).
 *
 * **연락처는 여기서만 나온다.** 수락된 컨택의 당사자에게만, 서버가 판단해서 준다.
 * 화면은 `phone` 키가 있는지 없는지만 본다 — 화면이 공개 여부를 판단하지 않는다.
 * 판단이 두 곳에 있으면 언젠가 갈라지고, 갈라지는 순간 연락처가 샌다.
 *
 * 시안이 이 화면에 넣어둔 것 중 구현에 없던 셋을 채웠다.
 * - **진행 타임라인**(요청 → 응답 → 연락처 공개). 지금 무엇을 기다리는지가 여기서 읽힌다.
 * - **연락처 블록**. 공개 전에도 자리를 보여준다 — 무엇이 열릴지 알아야 수락을 판단한다.
 * - **거절 확인 시트**. 되돌릴 수 없는 전이라 한 번 더 묻고 사유를 선택으로 받는다.
 *
 * 근거: design/M-01 M-02 컨택.dc.html · brain/30-설계/권한 모델.md
 */
export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading, authFetch } = useSession();
  const router = useRouter();

  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /** 거절 확인 시트를 열었는가. 열려 있는 동안 다른 버튼은 감춘다. */
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    const res = await authFetch<ContactDetail>(`/contacts/${id}`);
    setContact(res);
  }, [authFetch, id]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(`/contacts/${id}`)}`);
      return;
    }
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.message : '불러오지 못했습니다.');
    });
  }, [loading, user, id, load, router]);

  if (loading || !user) return null;

  if (!contact) {
    return (
      <div className="contacts contacts--detail">
        <section className="contacts__detail">
          {error && (
            <p role="alert" className="gallery-error">
              {error}
            </p>
          )}
        </section>
      </div>
    );
  }

  /*
   * 누가 무엇을 할 수 있는지는 서버가 최종 판단한다. 화면은 버튼을 감출 뿐이다.
   * 감추는 이유는 보안이 아니라 친절이다 — 누를 수 없는 버튼을 보여줄 이유가 없다.
   */
  const isReceiver = user.id === contact.receiverUserId;
  const isRequester = user.id === contact.requesterUserId;
  const open = contact.status === 'REQUESTED';
  const accepted = contact.status === 'ACCEPTED';
  const box = isReceiver ? 'received' : 'sent';

  async function act(path: string, body?: unknown) {
    setError(null);
    setPending(true);
    try {
      await authFetch(`/contacts/${id}/${path}`, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      setDeclining(false);
      await load();
    } catch (err) {
      /*
       * 상대가 먼저 처리한 경우가 여기 온다(시안의 "이미 처리됨").
       * 실패로 끝내지 않고 **갱신된 상태를 먼저 보여준다** — 화면이 낡았을 뿐이다.
       */
      setError(err instanceof ApiError ? err.message : '처리하지 못했습니다.');
      await load().catch(() => {});
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="contacts contacts--detail">
      <ContactList box={box} selectedId={contact.id} />

      <section className="contacts__detail" aria-label="컨택 상세">
        {/* 모바일에서만 보이는 뒤로 가기. 데스크톱은 왼쪽에 목록이 그대로 있다. */}
        <a href={`/contacts?box=${box}`} className="btn btn--secondary btn--sm contacts__back">
          ← 컨택 목록
        </a>

        <div className="contacts__head">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <span className={`contact-status badge--${statusTone(contact.status)}`}>
              {accepted ? '수락됨 · 연락처 공개' : CONTACT_STATUS_LABELS[contact.status]}
            </span>
            <h1 className="contact-h1">
              {isReceiver
                ? `${contact.counterpart.nickname}님의 문의`
                : `${contact.counterpart.nickname}님에게 보낸 문의`}
            </h1>
            <span className="contact-meta">
              {new Date(contact.createdAt).toLocaleString('ko-KR', {
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              요청 · {ago(contact.createdAt)}
            </span>
          </div>

          {/* 데스크톱은 액션을 제목 옆에, 모바일은 본문 아래에 둔다(시안 그대로). */}
          <div className="contacts__actions contacts__actions--desktop">
            {!declining && actionButtons()}
          </div>
        </div>

        {error && (
          <p role="alert" className="gallery-error">
            {error}
          </p>
        )}

        <Timeline contact={contact} />

        <div className="contacts__body">
          <div className="contacts__main">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span className="contact-section-title">
                {isReceiver ? '받은 메시지' : '보낸 메시지'}
              </span>
              <p className="contact-message">{contact.message}</p>
              {/*
                제안 금액. 안 적었으면 아예 안 쓴다 —
                "미정"이라고 쓰면 안 적은 게 흠처럼 보인다.
              */}
              {contact.proposedAmount !== null && (
                <p className="contact-amount">
                  {contact.proposedAmount.toLocaleString('ko-KR')}원 제안
                  {contact.proposedAmountNote && (
                    <span className="contact-locked__note" style={{ marginLeft: 'var(--space-2)' }}>
                      {contact.proposedAmountNote}
                    </span>
                  )}
                </p>
              )}
              {contact.declineReason && (
                <p className="contact-reason">거절 사유 — {contact.declineReason}</p>
              )}
            </div>

            <div className="contact-party">
              <Avatar name={contact.counterpart.nickname} size={52} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span className="contact-party__name">{contact.counterpart.nickname}</span>
                <span className="contact-party__meta">
                  {isReceiver ? '나에게 문의를 보낸 사람' : '내가 문의를 보낸 사람'}
                </span>
              </span>
            </div>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ContactBlock
              contact={contact}
              onView={() => void authFetch(`/contacts/${id}/view-contact`, { method: 'POST' })}
            />
          </aside>
        </div>

        {/* 거절 확인. 되돌릴 수 없으므로 한 번 더 묻고 사유는 선택으로 받는다. */}
        {declining && (
          <div className="decline-sheet" role="group" aria-label="거절 확인">
            <strong className="decline-sheet__title">이 컨택을 거절할까요?</strong>
            <span className="decline-sheet__body">
              거절하면 되돌릴 수 없습니다. 상대가 다시 요청해야 연결됩니다. 사유는 선택입니다.
            </span>
            <select
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-label="거절 사유 (선택)"
              style={{ height: 44 }}
            >
              <option value="">사유 선택 (선택)</option>
              {DECLINE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button
                variant="secondary"
                size="lg"
                block
                disabled={pending}
                onClick={() => setDeclining(false)}
              >
                돌아가기
              </Button>
              <Button
                variant="danger"
                size="lg"
                block
                pending={pending}
                onClick={() => void act('decline', reason ? { reason } : undefined)}
              >
                거절하기
              </Button>
            </div>
          </div>
        )}

        {/* 모바일 액션. 시안은 하단에 고정 바로 둔다. */}
        {!declining && (
          <div className="contacts__actions contacts__actions--mobile">{actionButtons()}</div>
        )}
      </section>
    </div>
  );

  /**
   * 상태와 역할에 따라 할 수 있는 일.
   *
   * 종료 상태(거절·취소·만료)에는 나가는 전이가 없다 — 시안이 "재수락 버튼을 두지
   * 않는다"고 못 박았다. 대신 지금이 어떤 상태인지 한 줄로 말한다.
   */
  function actionButtons() {
    if (!contact) return null;

    if (open && isReceiver) {
      return (
        <>
          <Button
            variant="secondary"
            size="lg"
            disabled={pending}
            onClick={() => setDeclining(true)}
          >
            거절
          </Button>
          <Button variant="primary" size="lg" pending={pending} onClick={() => void act('accept')}>
            수락하고 연락처 공개
          </Button>
        </>
      );
    }

    if (open && isRequester) {
      return (
        <Button variant="danger" size="lg" pending={pending} onClick={() => void act('cancel')}>
          요청 취소
        </Button>
      );
    }

    if (accepted) {
      return contact.counterpart.phone ? (
        <a href={`tel:${contact.counterpart.phone}`} className="btn btn--primary btn--lg">
          전화 걸기
        </a>
      ) : null;
    }

    return (
      <span className="contacts__note">
        {contact.status === 'DECLINED'
          ? '거절된 컨택입니다. 되돌릴 수 없으며 필요하면 새로 요청하세요.'
          : contact.status === 'CANCELLED'
            ? '취소된 컨택입니다. 다시 연결하려면 새 요청을 보내세요.'
            : '7일 동안 응답이 없어 기간이 지났습니다. 같은 상대에게 다시 요청할 수 있습니다.'}
      </span>
    );
  }
}

/**
 * 진행 타임라인.
 *
 * 요청 → 응답 → 연락처 공개. 상태 머신을 사람 말로 옮긴 것이고,
 * **지금 무엇을 기다리는가**가 여기서 읽힌다. 상태 뱃지 하나로는 그게 안 보인다.
 */
function Timeline({ contact }: { contact: ContactDetail }) {
  const open = contact.status === 'REQUESTED';
  const accepted = contact.status === 'ACCEPTED';
  const answered = !open;

  const steps = [
    {
      k: '요청',
      done: true,
      at: new Date(contact.createdAt).toLocaleString('ko-KR', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
    {
      k: accepted
        ? '수락'
        : contact.status === 'DECLINED'
          ? '거절'
          : contact.status === 'CANCELLED'
            ? '취소'
            : contact.status === 'EXPIRED'
              ? '만료'
              : '응답',
      done: answered,
      at: open
        ? contact.expiresAt
          ? `대기 중 · ${new Date(contact.expiresAt).toLocaleDateString('ko-KR')} 만료`
          : '대기 중'
        : '완료',
    },
    {
      k: '연락처 공개',
      done: accepted,
      at: accepted ? '수락과 동시에' : open ? '수락 시 공개' : '공개되지 않음',
    },
  ];

  return (
    <div className="timeline" aria-label="진행 상황">
      {steps.map((s, i) => (
        <div key={s.k} className={`timeline__step${s.done ? ' timeline__step--done' : ''}`}>
          <span className="timeline__marks">
            <span className="timeline__dot" aria-hidden="true" />
            {i < steps.length - 1 && (
              <span
                className={`timeline__line${steps[i + 1]?.done ? ' timeline__line--done' : ''}`}
                aria-hidden="true"
              />
            )}
          </span>
          <span className="timeline__k">{s.k}</span>
          <span className="timeline__at">{s.at}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * 연락처 블록.
 *
 * **공개 전에도 자리를 보여준다.** 무엇이 열리는지 알아야 수락을 판단할 수 있다.
 * 다만 마스킹은 화면의 표현일 뿐이고 **서버 응답에는 `phone` 키 자체가 없다** —
 * 화면이 가리는 구조였다면 이 보장이 없다.
 */
function ContactBlock({ contact, onView }: { contact: ContactDetail; onView: () => void }) {
  const phone = contact.counterpart.phone;

  if (phone) {
    return (
      <div className="contact-reveal">
        <strong className="contact-reveal__title">연락처가 공개되었습니다</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div className="contact-reveal__row">
            <span className="contact-reveal__k">이름</span>
            <span className="contact-reveal__v">{contact.counterpart.nickname}</span>
          </div>
          <div className="contact-reveal__row">
            <span className="contact-reveal__k">연락처</span>
            <span className="contact-reveal__v contact-reveal__v--tel">{phone}</span>
          </div>
        </div>
        {/* 열람 시점을 기록한다. 플랫폼 이탈 지표의 유일한 관측 지점이다. */}
        <a href={`tel:${phone}`} onClick={onView} className="btn btn--primary btn--lg btn--block">
          전화 걸기
        </a>
        <span className="contact-reveal__note">
          계약과 결제는 플랫폼 밖에서 직접 진행합니다. 문제가 생기면 신고로 접수해 주세요.
        </span>
      </div>
    );
  }

  return (
    <div className="contact-locked">
      <strong className="contact-locked__title">
        {contact.status === 'ACCEPTED'
          ? '상대가 연락처를 등록하지 않았습니다'
          : '연락처는 아직 공개되지 않았습니다'}
      </strong>
      <div className="contact-locked__row">
        <span className="contact-reveal__k">연락처</span>
        <span className="contact-locked__masked">010-••••-••••</span>
      </div>
      <span className="contact-locked__note">
        {contact.status === 'REQUESTED'
          ? '수락하면 양쪽 연락처가 동시에 열립니다. 그 전까지는 서버 응답에도 연락처가 들어 있지 않습니다.'
          : '종료된 컨택은 연락처를 공개하지 않습니다. 다시 연결하려면 새로 요청해야 합니다.'}
      </span>
    </div>
  );
}
