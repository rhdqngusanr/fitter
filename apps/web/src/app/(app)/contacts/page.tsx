'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { ContactList } from '../../../components/ContactList';
import { useSession } from '../../../lib/session';

/**
 * 컨택 목록 (M-01).
 *
 * **시안의 데스크톱은 목록과 상세를 나란히 둔다.** 이 화면은 그 왼쪽 판만 채워진
 * 상태다 — 오른쪽에는 "고르세요"가 있고, 하나 고르면 `/contacts/[id]` 가 같은
 * 레이아웃에 상세를 채운다. 모바일에서는 시안대로 목록만 보인다.
 *
 * **목록에서는 상태를 바꿀 수 없다.** 수락·거절은 상세에서만 일어난다.
 *
 * 근거: design/M-01 M-02 컨택.dc.html · brain/20-도메인/상태머신 - 컨택.md
 */
export default function ContactsPage() {
  return (
    <Suspense fallback={null}>
      <ContactsShell />
    </Suspense>
  );
}

function ContactsShell() {
  const { user, loading } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const box = params.get('box') === 'sent' ? 'sent' : 'received';

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent('/contacts')}`);
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <div className="contacts contacts--list">
      <ContactList box={box} />
      <div className="contacts__placeholder">
        <span className="empty__icon" aria-hidden="true" />
        <strong className="empty__title">컨택을 고르면 여기에 열립니다</strong>
        <span className="empty__body">
          수락·거절은 상세에서만 할 수 있습니다. 목록에서 바로 바꾸지 않는 이유는 상대의 메시지를
          읽지 않고 누르게 되기 때문입니다.
        </span>
      </div>
    </div>
  );
}
