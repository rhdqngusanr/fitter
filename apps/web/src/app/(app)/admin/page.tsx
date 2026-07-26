'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api';
import { useSession } from '../../../lib/session';
import { AdminShell } from './AdminShell';

interface PendingPro {
  userProfileId: string;
  userId: string;
  nickname: string;
  email: string;
  businessName: string;
  businessNumber: string | null;
  careerYears: number;
  profileCompleteness: number;
  rejectionReason: string | null;
  categories: { code: string; nameKo: string }[];
  serviceAreas: { code: string; sigunguName: string }[];
  portfolioCount: number;
  flags: string[];
  risk: 'low' | 'mid' | 'high';
  submittedAt: string;
}

interface Queue {
  items: PendingPro[];
  pendingCount: number;
  approvedToday: number;
}

type Filter = 'all' | 'incomplete' | 'rejected' | 'ready';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '대기 전체' },
  /* 심사할 값이 있는 것. 위험 신호가 없거나 하나뿐이면 대체로 바로 처리된다. */
  { key: 'ready', label: '심사 가능' },
  { key: 'incomplete', label: '프로필 미완성' },
  { key: 'rejected', label: '반려된 것' },
];

function stamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ${d
    .toTimeString()
    .slice(0, 5)}`;
}

/**
 * 시공자 승인 큐 (A-01).
 *
 * **한 줄에 판단 근거를 다 넣는 것이 이 화면의 설계다.** 대부분은 목록에서 바로 처리하고
 * 애매한 것만 상세 드로어를 연다. 위험 신호는 지어낸 값이 아니라 우리가 이미 가진
 * 사실에서 계산한 것이다 — 사업자번호 유무, 공종·지역 선택 여부, 포트폴리오 수.
 *
 * 전에는 이 화면이 없어서 **승인을 수동 DB 작업으로 했다.**
 *
 * 시안: design/A-01 A-02 관리자.dc.html
 */
export default function AdminApprovalsPage() {
  const { authFetch } = useSession();
  const [queue, setQueue] = useState<Queue | null>(null);
  const [reportCount, setReportCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState<PendingPro | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  /** 방금 처리한 것. 되돌리기는 `approved: false` 를 다시 보내는 것이다. */
  const [done, setDone] = useState<{ ids: string[]; approved: boolean; label: string } | null>(null);

  const load = useCallback(async () => {
    const [q, r] = await Promise.all([
      authFetch<Queue>('/admin/pro-approvals'),
      authFetch<{ pendingCount: number }>('/admin/reports'),
    ]);
    setQueue(q);
    setReportCount(r.pendingCount);
  }, [authFetch]);

  useEffect(() => {
    let alive = true;
    void load().catch((err: unknown) => {
      if (alive) setError(err instanceof ApiError ? err.message : '불러오지 못했습니다.');
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const shown = useMemo(() => {
    if (!queue) return [];
    const q = search.trim().toLowerCase();
    return queue.items.filter((p) => {
      if (filter === 'incomplete' && p.flags.length < 3) return false;
      if (filter === 'ready' && p.flags.length >= 3) return false;
      if (filter === 'rejected' && !p.rejectionReason) return false;
      if (!q) return true;
      return [p.businessName, p.nickname, p.email, p.businessNumber ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [queue, filter, search]);

  async function decide(ids: string[], approved: boolean, why?: string, undone = false) {
    setBusy(ids.join(',') || 'bulk');
    setError(null);
    try {
      /*
       * 일괄 처리는 순차로 보낸다. API 가 한 건씩 받고, **한 건이 실패해도
       * 나머지가 처리된 상태를 알아야 한다** — 병렬로 던지고 전체를 실패로
       * 처리하면 무엇이 승인됐는지 모른 채 다시 눌러야 한다.
       */
      const failed: string[] = [];
      for (const id of ids) {
        try {
          await authFetch(`/admin/pro-approvals/${id}`, {
            method: 'POST',
            body: JSON.stringify({ approved, reason: why }),
          });
        } catch {
          failed.push(id);
        }
      }
      await load();
      setSelected([]);
      setOpen(null);
      setReason('');

      const okIds = ids.filter((id) => !failed.includes(id));
      if (failed.length > 0) {
        setError(`${failed.length}건은 처리하지 못했습니다. 목록을 확인해 주세요.`);
      }
      if (okIds.length > 0) {
        /*
         * 되돌리기는 `approved: false` 를 보내는 것이라 실제로 반려다.
         * 그렇다고 토스트에 "반려했습니다"를 띄우면 운영자가 방금 되돌린 걸
         * **새 조치로 읽는다** — 눌러보고 알았다. 문구를 구분한다.
         */
        setDone({
          ids: okIds,
          approved,
          label: undone
            ? '되돌렸습니다'
            : `${okIds.length}명 ${approved ? '승인' : '반려'}했습니다`,
        });
      }
    } finally {
      setBusy(null);
    }
  }

  /** 되돌리기. 승인을 취소하면 그 시공자의 사례가 즉시 갤러리에서 내려간다. */
  async function undo() {
    if (!done) return;
    const { ids, approved } = done;
    setDone(null);
    await decide(ids, !approved, approved ? '승인을 되돌렸습니다.' : undefined, true);
  }

  const riskTone = (risk: PendingPro['risk']) =>
    risk === 'high' ? 'danger' : risk === 'mid' ? 'warning' : 'success';

  return (
    <AdminShell
      active="approvals"
      title="시공자 승인"
      endpoint="GET · POST /admin/pro-approvals"
      searchPlaceholder="활동명·닉네임·이메일·사업자번호 검색"
      search={search}
      onSearch={setSearch}
      counts={{ approvals: queue?.pendingCount ?? null, reports: reportCount }}
    >
      <div className="adm__bar">
        <div className="chip-row chip-row--wrap">
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
        <div className="adm__kpis">
          <span className="adm__kpi">
            <strong
              className={`adm__kpi-value ${
                (queue?.pendingCount ?? 0) === 0
                  ? 'adm__kpi-value--success'
                  : 'adm__kpi-value--warning'
              }`}
            >
              {queue?.pendingCount ?? '—'}
            </strong>
            <span className="adm__kpi-label">대기</span>
          </span>
          <span className="adm__kpi">
            <strong className="adm__kpi-value">{queue?.approvedToday ?? '—'}</strong>
            <span className="adm__kpi-label">오늘 승인</span>
          </span>
          {/*
            시안의 `평균 처리 6시간` 은 넣지 않았다. 승인된 건의 createdAt→approvedAt 로
            계산할 수는 있지만 표본이 한 자리 수라 평균이 아무 뜻도 없다.
          */}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="adm__bulk">
          <span className="adm__bulk-text">
            {selected.length}명 선택됨 · 위험 신호를 확인한 건만 일괄 승인하세요
          </span>
          <span className="adm__bulk-actions">
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              선택 해제
            </Button>
            <Button
              variant="secondary"
              size="sm"
              pending={busy === 'bulk' || busy === selected.join(',')}
              onClick={() => void decide(selected, true)}
            >
              일괄 승인
            </Button>
          </span>
        </div>
      )}

      {error && (
        <p role="alert" className="form-error" style={{ margin: 'var(--space-4) 28px 0' }}>
          {error}
        </p>
      )}

      {/* 아직 못 불러온 것과 0건은 다르다. → admin/reports/page.tsx 의 같은 자리 */}
      {!queue ? (
        <div className="adm__table-wrap" aria-busy="true" style={{ padding: '28px' }}>
          <span className="skeleton" style={{ height: '160px', display: 'block' }} />
        </div>
      ) : queue.items.length === 0 ? (
        <div className="adm-empty">
          <strong className="adm-empty__title">대기 중인 승인 요청이 없습니다</strong>
          <span className="adm-empty__body">
            {/*
              시안은 "마지막 처리는 오늘 14:32 · 오늘 승인 9건, 반려 1건"을 적었다.
              오늘 승인 수는 셀 수 있어서 쓰고, **마지막 처리 시각과 반려 수는 세는
              곳이 없어서** 뺐다.
            */}
            오늘 {queue.approvedToday}건을 승인했습니다. 새 신청이 들어오면 이 목록에 쌓입니다.
          </span>
          <div className="adm-empty__actions">
            <Link className="btn btn--primary btn--md" href="/admin/reports">
              신고 큐로 이동
            </Link>
          </div>
        </div>
      ) : (
        <div className="adm__table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th style={{ width: '48px' }}>
                  <span className="visually-hidden">선택</span>
                </th>
                <th>시공자</th>
                <th>공종 · 지역</th>
                <th>사업자번호</th>
                <th style={{ width: '110px' }}>포트폴리오</th>
                <th>위험 신호</th>
                <th style={{ width: '150px' }}>신청</th>
                <th style={{ width: '200px' }}>
                  <span className="visually-hidden">처리</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const on = selected.includes(p.userProfileId);
                return (
                  <tr
                    key={p.userProfileId}
                    data-selected={on}
                    data-open={open?.userProfileId === p.userProfileId}
                  >
                    <td>
                      <button
                        type="button"
                        className="adm-check"
                        aria-pressed={on}
                        aria-label={`${p.businessName || p.nickname} 선택`}
                        onClick={() =>
                          setSelected((cur) =>
                            cur.includes(p.userProfileId)
                              ? cur.filter((x) => x !== p.userProfileId)
                              : [...cur, p.userProfileId],
                          )
                        }
                      >
                        ✓
                      </button>
                    </td>
                    <td>
                      <span className="adm-cell">
                        <strong className="adm-cell__strong">
                          {p.businessName || `${p.nickname} (활동명 없음)`}
                        </strong>
                        <span className="adm-cell__mono">
                          {p.email} · 경력 {p.careerYears}년 · 완성도 {p.profileCompleteness}%
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="adm-cell">
                        <span className="adm-cell__main">
                          {p.categories.map((c) => c.nameKo).join('·') || '미선택'}
                        </span>
                        <span className="adm-cell__sub">
                          {p.serviceAreas.map((a) => a.sigunguName).join('·') || '미선택'}
                        </span>
                      </span>
                    </td>
                    <td>
                      {p.businessNumber ? (
                        <span className="adm-cell__mono">{p.businessNumber}</span>
                      ) : (
                        <Badge tone="danger" size="xs">
                          미제출
                        </Badge>
                      )}
                    </td>
                    <td>
                      <span
                        className={`adm-cell__count${
                          p.portfolioCount === 0 ? ' adm-cell__count--zero' : ''
                        }`}
                      >
                        {p.portfolioCount}건
                      </span>
                    </td>
                    <td>
                      {p.flags.length > 0 ? (
                        <span className="adm-cell__flags">
                          {p.flags.map((f) => (
                            <Badge key={f} tone={riskTone(p.risk)} size="xs">
                              {f}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        <Badge tone="success" size="xs">
                          이상 없음
                        </Badge>
                      )}
                    </td>
                    <td>
                      <span className="adm-cell__sub" style={{ whiteSpace: 'nowrap' }}>
                        {stamp(p.submittedAt)}
                      </span>
                    </td>
                    <td>
                      <span className="adm-cell__actions">
                        <Button variant="ghost" size="sm" onClick={() => setOpen(p)}>
                          상세
                        </Button>
                        <Button
                          size="sm"
                          pending={busy === p.userProfileId}
                          onClick={() => void decide([p.userProfileId], true)}
                        >
                          승인
                        </Button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div
          className="adm-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(null);
          }}
        >
          <div className="adm-drawer__box">
            <div className="adm-drawer__head">
              <h2 id="drawer-title" className="adm-drawer__title">
                {open.businessName || `${open.nickname} (활동명 없음)`}
              </h2>
              <p className="adm-drawer__sub">{open.email}</p>
            </div>

            <div className="adm-drawer__body">
              {open.rejectionReason && (
                <p className="adm-drawer__note">
                  <strong>이전 반려 사유</strong>
                  <br />
                  {open.rejectionReason}
                </p>
              )}

              <div>
                <span className="adm-drawer__section-title">제출 내용</span>
                <div className="adm-drawer__rows">
                  {[
                    ['활동명', open.businessName || '미입력'],
                    ['사업자등록번호', open.businessNumber || '미제출'],
                    ['경력', `${open.careerYears}년`],
                    ['공종', open.categories.map((c) => c.nameKo).join('·') || '미선택'],
                    ['활동 지역', open.serviceAreas.map((a) => a.sigunguName).join('·') || '미선택'],
                    ['포트폴리오', `${open.portfolioCount}건`],
                    ['프로필 완성도', `${open.profileCompleteness}%`],
                    ['신청', stamp(open.submittedAt)],
                  ].map(([k, v]) => (
                    <span key={k} className="adm-drawer__row">
                      <span className="adm-drawer__row-key">{k}</span>
                      <span className="adm-drawer__row-value">{v}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="adm-drawer__section-title">위험 신호</span>
                <div className="adm-cell__flags" style={{ marginTop: 'var(--space-2)' }}>
                  {open.flags.length > 0 ? (
                    open.flags.map((f) => (
                      <Badge key={f} tone={riskTone(open.risk)} size="xs">
                        {f}
                      </Badge>
                    ))
                  ) : (
                    <Badge tone="success" size="xs">
                      이상 없음
                    </Badge>
                  )}
                </div>
              </div>

              {/*
                시안은 여기에 서류 원본 뷰어와 포트폴리오 그리드를 뒀다.
                **서류 저장이 없어서** 뷰어는 만들 수 없고, 포트폴리오는 승인 전이라
                공개 목록에 없으므로 개수만 위에 적었다.
              */}
              <p className="adm-drawer__note">
                제출 서류 원본은 아직 받지 않습니다. 판단 근거는 사업자등록번호와 위 항목뿐입니다.
              </p>

              <div>
                <span className="adm-drawer__section-title">반려 사유</span>
                <textarea
                  className="input"
                  rows={3}
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="무엇을 고쳐서 다시 제출해야 하는지 적어주세요. 이 문구가 시공자의 프로필 화면에 그대로 보입니다."
                  style={{ marginTop: 'var(--space-2)' }}
                />
              </div>
            </div>

            <div className="adm-drawer__actions">
              <div className="adm-drawer__action-row">
                <Button
                  variant="danger"
                  block
                  /* 사유 없는 반려는 시공자가 무엇을 고칠지 알 수 없다. */
                  disabled={reason.trim().length === 0}
                  pending={busy === open.userProfileId}
                  onClick={() => void decide([open.userProfileId], false, reason.trim())}
                >
                  반려
                </Button>
                <Button
                  block
                  pending={busy === open.userProfileId}
                  onClick={() => void decide([open.userProfileId], true)}
                >
                  승인
                </Button>
              </div>
              <Button variant="ghost" block onClick={() => setOpen(null)}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}

      {done && (
        <div className="adm-toast" role="status">
          <span>{done.label}</span>
          <button type="button" onClick={() => void undo()}>
            되돌리기
          </button>
          <button type="button" onClick={() => setDone(null)} aria-label="닫기">
            ✕
          </button>
        </div>
      )}
    </AdminShell>
  );
}
