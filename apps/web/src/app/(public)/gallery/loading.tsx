import { WORK_CATEGORY_SEEDS } from '@fitter/shared';

import { GridSkeletonCard } from '../../../components/GalleryGrid';

/**
 * 갤러리 첫 진입 스켈레톤.
 *
 * **시안(C-04)의 8상태 중 "로딩"이 이 파일이다** — "필터 바는 즉시 렌더되고 그리드만
 * 자리를 잡아둔다 — 레이아웃이 튀지 않는다."
 *
 * 화면 안에서 로딩을 흉내내지 않고 Next 의 route 단위 로딩 UI 로 만든 이유:
 * 갤러리는 서버 컴포넌트라 데이터를 기다리는 주체가 서버다. 여기 두면 서버가
 * 조회하는 동안 이 HTML 이 먼저 나가고, 완성되면 통째로 교체된다.
 *
 * 칩은 진짜 목록을 그린다 — 공종은 `packages/shared` 정본이라 조회가 필요 없다.
 * 필터가 스켈레톤이면 사용자는 아무것도 누를 수 없는데, 실제로는 누를 수 있다.
 */
export default function GalleryLoading() {
  return (
    <main
      className="shell"
      style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-12)' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <div className="gallery-head hide-on-mobile">
          <h1 className="gallery-h1">실제로 시공된 사진만 모았습니다</h1>
          <p className="gallery-lead">
            연출 컷이 아니라 시공자가 직접 올린 결과물입니다. 마음에 드는 사진에서 바로 시공자에게
            문의하세요.
          </p>
        </div>

        <div className="gallery-filters">
          <div className="chip-row" aria-hidden="true">
            <span className="chip">전체</span>
            {WORK_CATEGORY_SEEDS.map((category) => (
              <span key={category.code} className="chip">
                {category.nameKo}
              </span>
            ))}
          </div>
        </div>

        {/* 건수는 아직 모른다. 자리만 잡아둔다 — 숫자를 0으로 먼저 쓰면 거짓말이 된다. */}
        <span className="skeleton" style={{ display: 'block', width: 120, height: 14 }} />

        <ul className="gallery-grid" aria-label="불러오는 중">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i}>
              <GridSkeletonCard />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
