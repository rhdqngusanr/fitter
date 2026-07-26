'use client';

import { CONTACT_STATUS_LABELS, type ContactStatus } from '@fitter/shared';

/**
 * 컨택 상태 배지.
 *
 * **REQUESTED만 눈에 띄게 한다.** 할 일이 남은 건 그것뿐이고,
 * 끝난 상태들이 같이 튀면 무엇을 봐야 하는지가 흐려진다.
 */
export function StatusChip({ status }: { status: ContactStatus }) {
  const tone =
    status === 'REQUESTED'
      ? { bg: 'var(--color-warning-bg)', fg: 'var(--color-warning)' }
      : status === 'ACCEPTED'
        ? { bg: 'var(--color-success-bg)', fg: 'var(--color-success)' }
        : { bg: 'var(--color-bg-sunken)', fg: 'var(--color-text-tertiary)' };

  return (
    <span
      style={{
        flexShrink: 0,
        background: tone.bg,
        color: tone.fg,
        borderRadius: 'var(--radius-full)',
        padding: '2px 10px',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {CONTACT_STATUS_LABELS[status]}
    </span>
  );
}
