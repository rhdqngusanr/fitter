'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { ApiError } from '../../../../lib/api';
import { useSession } from '../../../../lib/session';
import { AdminShell } from '../AdminShell';

interface Report {
  id: string;
  type: 'COPYRIGHT' | 'INAPPROPRIATE' | 'SPAM';
  targetType: 'REFERENCE_REQUEST' | 'PORTFOLIO_ITEM' | 'USER';
  targetId: string;
  reason: string | null;
  rightsHolderName: string | null;
  originalSourceUrl: string | null;
  createdAt: string;
  reporter: { id: string; nickname: string } | null;
  target: { label: string; status: string; repeatCount: number };
}

interface Queue {
  items: Report[];
  pendingCount: number;
  weekCount: number;
  suspendedCount: number;
}

/**
 * 신고 유형. `ReportType` 은 셋뿐이다.
 *
 * 시안은 `허위 포트폴리오 · 연락처 외부 유도 · 부적절한 사진 · 노쇼` 넷을 그렸는데
 * **스키마에 없는 유형이다.** 화면에서 이름을 지어내면 신고 폼과 어긋난다.
 */
const TYPE_LABELS: Record<Report['type'], string> = {
  COPYRIGHT: '저작권 침해',
  INAPPROPRIATE: '부적절한 내용',
  SPAM: '스팸·광고',
};

const TARGET_LABELS: Record<Report['targetType'], string> = {
  REFERENCE_REQUEST: '의뢰',
  PORTFOLIO_ITEM: '포트폴리오',
  USER: '계정',
};

type Filter = 'all' | 'copyright' | 'repeat';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '미처리 전체' },
  /* 저작권은 권리자가 기다리고 있어 우선순위가 다르다. */
  { key: 'copyright', label: '저작권' },
  { key: 'repeat', label: '재발 대상' },
];

function stamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ${d
    .toTimeString()
    .slice(0, 5)}`;
}

/** 대상 화면으로 가는 링크. 계정은 승인된 시공자일 때만 공개 프로필이 있다. */
function targetHref(report: Report): string | null {
  if (report.targetType === 'PORTFOLIO_ITEM') return `/gallery/${report.targetId}`;
  if (report.targetType === 'USER') return `/pros/${report.targetId}`;
  /* 의뢰는 소유자만 볼 수 있다. 관리자용 의뢰 조회 화면은 없다. */
  return null;
}

/**
 * 신고 처리 큐 (A-02).
 *
 * **시안보다 얇다. `Report` 가 시안이 가정한 것보다 단순하기 때문이다** —
 * 심각도 컬럼도 증거 사진도 없고 유형은 셋뿐이다. 없는 필드를 지어내지 않는다.
 *
 * 심각도의 실질적 대체는 **같은 대상에 신고가 쌓인 횟수**다. 그건 셀 수 있다.
 *
 * 조치도 둘뿐이다 — 인정(대상 즉시 비공개)과 기각. 시안의 `경고 · 계정 정지` 는
 * 담을 곳이 없다.
 *
 * 시안: design/A-01 A-02 관리자.dc.html
 */
export default function AdminReportsPage() {
  const { authFetch } = useSession();
  const [queue, setQueue] = useState<Queue | null>(null);
  const [approvalCount, setApprovalCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Report | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [q, a] = await Promise.all([
      authFetch<Queue>('/admin/reports'),
      authFetch<{ pendingCount: number }>('/admin/pro-approvals'),
    ]);
    setQueue(q);
    setApprovalCount(a.pendingCount);
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
    return queue.items.filter((r) => {
      if (filter === 'copyright' && r.type !== 'COPYRIGHT') return false;
      if (filter === 'repeat' && r.target.repeatCount < 2) return false;
      if (!q) return true;
      return [r.target.label, r.reason ?? '', r.rightsHolderName ?? '', r.reporter?.nickname ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [queue, filter, search]);

  async function resolve(id: string, accept: boolean) {
    setBusy(id);
    setError(null);
    try {
      await authFetch(`/admin/reports/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ accept }),
      });
      await load();
      setOpen(null);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : '처리하지 못했습니다.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell
      active="reports"
      title="신고 처리"
      endpoint="GET · POST /admin/reports"
      searchPlaceholder="대상·신고 내용·권리자 검색"
      search={search}
      onSearch={setSearch}
      counts={{ approvals: approvalCount, reports: queue?.pendingCount ?? null }}
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
                  : 'adm__kpi-value--danger'
              }`}
            >
              {queue?.pendingCount ?? '—'}
            </strong>
            <span className="adm__kpi-label">미처리</span>
          </span>
          <span className="adm__kpi">
            <strong className="adm__kpi-value">{queue?.weekCount ?? '—'}</strong>
            <span className="adm__kpi-label">최근 7일 신고</span>
          </span>
          <span className="adm__kpi">
            <strong className="adm__kpi-value">{queue?.suspendedCount ?? '—'}</strong>
            <span className="adm__kpi-label">정지 계정</span>
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="form-error" style={{ margin: 'var(--space-4) 28px 0' }}>
          {error}
        </p>
      )}

      {/*
        **아직 못 불러온 것과 0건은 다르다.** 처음에는 `queue` 가 null 일 때도 표를
        그려서, 로드가 실패한 화면이 머리글만 남은 "0건짜리 표"로 보였다.
        운영자는 그걸 "신고가 없다"로 읽는다.
      */}
      {!queue ? (
        <div className="adm__table-wrap" aria-busy="true" style={{ padding: '28px' }}>
          <span className="skeleton" style={{ height: '160px', display: 'block' }} />
        </div>
      ) : queue.items.length === 0 ? (
        <div className="adm-empty">
          <strong className="adm-empty__title">미처리 신고가 없습니다</strong>
          <span className="adm-empty__body">
            최근 7일간 {queue.weekCount}건이 접수됐고 모두 처리됐습니다. 저작권 신고는 비로그인
            상태에서도 접수되므로 이 큐를 주기적으로 확인해야 합니다.
          </span>
          <div className="adm-empty__actions">
            <Link className="btn btn--primary btn--md" href="/admin">
              승인 큐로 이동
            </Link>
          </div>
        </div>
      ) : (
        <div className="adm__table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>유형</th>
                <th>대상</th>
                <th style={{ width: '200px' }}>신고자 · 시각</th>
                <th>내용</th>
                <th style={{ width: '210px' }}>
                  <span className="visually-hidden">처리</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const href = targetHref(r);
                return (
                  <tr key={r.id} data-open={open?.id === r.id}>
                    <td>
                      <span className="adm-cell">
                        <strong className="adm-cell__strong">{TYPE_LABELS[r.type]}</strong>
                        {r.target.repeatCount > 1 && (
                          <Badge tone="danger" size="xs">
                            누적 {r.target.repeatCount}건
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td>
                      <span className="adm-cell">
                        <span className="adm-cell__main">
                          {href ? <Link href={href}>{r.target.label}</Link> : r.target.label}
                        </span>
                        <span className="adm-cell__sub">
                          {TARGET_LABELS[r.targetType]}
                          {r.target.status === 'HIDDEN' && ' · 이미 비공개'}
                          {r.target.status === 'GONE' && ' · 삭제됨'}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="adm-cell">
                        <span className="adm-cell__main">
                          {/* 저작권 신고는 비로그인도 낼 수 있다. 신고자가 없는 건 정상이다. */}
                          {r.reporter?.nickname ?? r.rightsHolderName ?? '비로그인 신고'}
                        </span>
                        <span className="adm-cell__sub">{stamp(r.createdAt)}</span>
                      </span>
                    </td>
                    <td>
                      <span className="adm-cell__sub">
                        {r.reason ? `${r.reason.slice(0, 60)}${r.reason.length > 60 ? '…' : ''}` : '내용 없음'}
                      </span>
                    </td>
                    <td>
                      <span className="adm-cell__actions">
                        <Button variant="ghost" size="sm" onClick={() => setOpen(r)}>
                          상세
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          pending={busy === r.id}
                          onClick={() => void resolve(r.id, false)}
                        >
                          기각
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          pending={busy === r.id}
                          onClick={() => void resolve(r.id, true)}
                        >
                          비공개
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
          aria-labelledby="report-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(null);
          }}
        >
          <div className="adm-drawer__box">
            <div className="adm-drawer__head">
              <h2 id="report-title" className="adm-drawer__title">
                {TYPE_LABELS[open.type]}
              </h2>
              <p className="adm-drawer__sub">
                {TARGET_LABELS[open.targetType]} · {open.target.label}
              </p>
            </div>

            <div className="adm-drawer__body">
              <div>
                <span className="adm-drawer__section-title">신고 내용</span>
                <p className="adm-drawer__note" style={{ marginTop: 'var(--space-2)' }}>
                  {open.reason ?? '작성된 내용이 없습니다.'}
                </p>
              </div>

              <div>
                <span className="adm-drawer__section-title">접수 정보</span>
                <div className="adm-drawer__rows">
                  {[
                    ['신고자', open.reporter?.nickname ?? '비로그인'],
                    ['접수', stamp(open.createdAt)],
                    ['대상 상태', open.target.status],
                    ['같은 대상 누적', `${open.target.repeatCount}건`],
                    ...(open.rightsHolderName ? [['권리자', open.rightsHolderName]] : []),
                  ].map(([k, v]) => (
                    <span key={k} className="adm-drawer__row">
                      <span className="adm-drawer__row-key">{k}</span>
                      <span className="adm-drawer__row-value">{v}</span>
                    </span>
                  ))}
                </div>
              </div>

              {open.originalSourceUrl && (
                <div>
                  <span className="adm-drawer__section-title">원본 출처</span>
                  <p className="adm-drawer__note" style={{ marginTop: 'var(--space-2)' }}>
                    {/*
                      신고자가 넣은 URL 이다. **새 탭으로만 열고 referrer 를 보내지 않는다** —
                      관리자 화면 주소가 외부로 새면 안 된다.
                    */}
                    <a href={open.originalSourceUrl} target="_blank" rel="noreferrer noopener">
                      {open.originalSourceUrl}
                    </a>
                  </p>
                </div>
              )}

              {/*
                시안은 증거 사진 그리드를 뒀다. `Report` 에 증거 이미지가 없다 —
                신고 폼이 사진을 받지 않는다. 대상 화면 링크가 그 역할을 대신한다.
              */}
              <p className="adm-drawer__note">
                {open.targetType === 'USER'
                  ? '계정 신고를 인정해도 계정이 정지되지는 않습니다. 정지 상태를 되돌리는 경로가 아직 없어 사람이 따로 판단합니다.'
                  : '인정하면 대상이 즉시 비공개(HIDDEN)로 바뀝니다. 되돌리려면 DB 조작이 필요합니다.'}
              </p>
            </div>

            <div className="adm-drawer__actions">
              <div className="adm-drawer__action-row">
                <Button
                  variant="ghost"
                  block
                  pending={busy === open.id}
                  onClick={() => void resolve(open.id, false)}
                >
                  기각
                </Button>
                <Button
                  variant="danger"
                  block
                  pending={busy === open.id}
                  onClick={() => void resolve(open.id, true)}
                >
                  인정하고 비공개
                </Button>
              </div>
              <Button variant="ghost" block onClick={() => setOpen(null)}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
