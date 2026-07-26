'use client';

import { useEffect, useState } from 'react';

import { CONTACT_STATUS_LABELS, type ContactStatus } from '@fitter/shared';

import { ApiError } from '../lib/api';
import { useSession } from '../lib/session';

import { Avatar } from './ui/Avatar';

export interface ContactRow {
  id: string;
  status: ContactStatus;
  message: string;
  proposedAmount: number | null;
  expiresAt: string | null;
  createdAt: string;
  counterpart: { id: string; nickname: string };
}

/**
 * 상태 필터.
 *
 * 시안의 다섯 칩이다. `거절됨` 에 CANCELLED 를 같이 넣은 것도 시안 그대로 —
 * 사용자에게는 "성사되지 않은 것"이 한 덩어리다. 누가 끝냈는지는 상세에서 말한다.
 */
const FILTERS = [
  { key: 'all', label: '전체', match: () => true },
  { key: 'open', label: '응답 대기', match: (s: ContactStatus) => s === 'REQUESTED' },
  { key: 'accepted', label: '수락됨', match: (s: ContactStatus) => s === 'ACCEPTED' },
  {
    key: 'closed',
    label: '거절됨',
    match: (s: ContactStatus) => s === 'DECLINED' || s === 'CANCELLED',
  },
  { key: 'expired', label: '만료됨', match: (s: ContactStatus) => s === 'EXPIRED' },
] as const;

/** 목록 뱃지 색. 상세의 큰 상태와 같은 규칙을 쓴다. */
export function statusTone(status: ContactStatus) {
  if (status === 'REQUESTED') return 'warning';
  if (status === 'ACCEPTED') return 'success';
  if (status === 'DECLINED') return 'danger';
  return 'muted';
}

/**
 * 컨택 목록 (M-01).
 *
 * **목록에서는 상태를 바꿀 수 없다.** 수락·거절은 상세에서만 일어난다.
 * 목록에 버튼을 달면 상대 메시지를 읽지 않고 누르게 되고, 수락은 되돌릴 수 없다.
 *
 * 데스크톱에서는 상세 화면 왼쪽에 그대로 남는다 — 시안이 목록·상세를 나란히 뒀다.
 * 컨택을 하나 처리할 때마다 목록으로 돌아갔다 다시 들어오는 왕복을 없애는 게 그 목적이다.
 *
 * 근거: design/M-01 M-02 컨택.dc.html · brain/20-도메인/상태머신 - 컨택.md
 */
export function ContactList({
  box,
  selectedId,
}: {
  box: 'received' | 'sent';
  selectedId?: string;
}) {
  const { user, loading, authFetch } = useSession();
  const [items, setItems] = useState<ContactRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  /** 받은함의 미응답 건수. 탭 뱃지에 쓴다 — 다른 함에 있어도 보여야 한다. */
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let alive = true;
    setItems(null);
    void (async () => {
      try {
        const res = await authFetch<{ items: ContactRow[] }>(`/contacts?box=${box}`);
        if (alive) setItems(res.items);
      } catch (err) {
        if (alive) setError(err instanceof ApiError ? err.message : '불러오지 못했습니다.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [loading, user, box, authFetch]);

  /* 뱃지는 어느 함을 보고 있든 "받은함에 답할 게 몇 건인가"를 말한다. */
  useEffect(() => {
    if (loading || !user) return;
    let alive = true;
    void authFetch<{ items: ContactRow[] }>('/contacts?box=received&status=REQUESTED')
      .then((res) => {
        if (alive) setPendingCount(res.items.length);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [loading, user, authFetch]);

  const rule = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const shown = items?.filter((c) => rule.match(c.status)) ?? null;

  return (
    <section aria-label="컨택 목록" className="contacts__list">
      <div className="box-tabs">
        {(['received', 'sent'] as const).map((key) => (
          <a
            key={key}
            href={`/contacts?box=${key}`}
            className="box-tab"
            aria-current={box === key ? 'page' : undefined}
          >
            <span>{key === 'received' ? '받은 것' : '보낸 것'}</span>
            {key === 'received' && !!pendingCount && (
              <span className="box-tab__badge">{pendingCount}</span>
            )}
          </a>
        ))}
      </div>

      <div className="contacts__filters" role="group" aria-label="상태 필터">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className="chip chip--sm"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="contacts__rows">
        {error && (
          <p role="alert" className="gallery-error">
            {error}
          </p>
        )}

        {shown === null
          ? null
          : shown.length === 0
            ? emptyBlock(items?.length === 0, box)
            : shown.map((c) => (
                <a
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  className="contact-row"
                  aria-current={c.id === selectedId ? 'page' : undefined}
                >
                  <Avatar name={c.counterpart.nickname} size={40} />
                  <span className="contact-row__body">
                    <span className="contact-row__head">
                      <span className="contact-row__name">{c.counterpart.nickname}</span>
                      <span className="contact-row__when">{ago(c.createdAt)}</span>
                    </span>
                    <span className="contact-row__sub">{c.message}</span>
                    <span className="contact-row__foot">
                      <span className={`badge badge--xs badge--${statusTone(c.status)}`}>
                        {CONTACT_STATUS_LABELS[c.status]}
                      </span>
                      <span className="contact-row__extra">{extraOf(c)}</span>
                    </span>
                  </span>
                </a>
              ))}
      </div>
    </section>
  );
}

/**
 * 빈 상태.
 *
 * **필터 때문에 0건인 것과 아예 0건인 것을 나눈다.** 갤러리에서와 같은 원칙이다 —
 * 둘을 섞으면 "필터를 풀면 볼 게 있다"는 사실이 사라진다.
 */
function emptyBlock(reallyEmpty: boolean, box: 'received' | 'sent') {
  if (!reallyEmpty) {
    return (
      <div className="empty">
        <span className="empty__body">그 상태의 컨택이 없습니다.</span>
      </div>
    );
  }
  return (
    <div className="empty">
      <strong className="empty__title">
        {box === 'received' ? '아직 받은 컨택이 없습니다' : '아직 보낸 컨택이 없습니다'}
      </strong>
      <span className="empty__body">
        {box === 'received'
          ? '사례를 채우거나 의뢰를 올려두면 상대가 먼저 문의합니다.'
          : '마음에 드는 시공 사진에서 바로 문의할 수 있습니다.'}
      </span>
      <a href="/gallery" className="btn btn--primary btn--lg" style={{ marginTop: 6 }}>
        시공 사진 보러 가기
      </a>
    </div>
  );
}

/** 목록의 오른쪽 위 시각. 며칠 지난 건 날짜가 낫고 오늘 건 상대 시간이 낫다. */
export function ago(iso: string) {
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}시간 전`;
  if (mins < 60 * 24 * 7) return `${Math.floor(mins / 1440)}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

/**
 * 상태 뱃지 옆의 한 마디.
 *
 * 시안은 여기에 `6일 뒤 만료` · `연락처 공개됨` 처럼 **다음에 무슨 일이 일어나는지**를 쓴다.
 * 상태 이름만으로는 지금 뭘 해야 하는지가 안 읽힌다.
 */
function extraOf(c: ContactRow) {
  if (c.status === 'ACCEPTED') return '연락처 공개됨';
  if (c.status === 'REQUESTED' && c.expiresAt) {
    const days = Math.ceil((new Date(c.expiresAt).getTime() - Date.now()) / 86400000);
    return days > 0 ? `${days}일 뒤 만료` : '오늘 만료';
  }
  if (c.status === 'REQUESTED') return '응답 대기';
  if (c.proposedAmount !== null) return `${c.proposedAmount.toLocaleString('ko-KR')}원 제안`;
  return '';
}
