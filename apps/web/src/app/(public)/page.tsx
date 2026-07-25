import { WORK_CATEGORY_SEEDS } from '@fitter/shared';

/**
 * 뼈대 확인용 페이지. 화면 구현은 P4에서 시작한다.
 *
 * 여기서 하는 일은 하나다 — 워크스페이스 패키지(@fitter/shared)가 실제로 연결됐는지 보이는 것.
 * 공종 목록이 화면마다 갈라지지 않는 이유가 이 import 하나다.
 */
export default function Page() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '48px 24px', lineHeight: 1.6 }}>
      <h1>Fitter</h1>
      <p>사진으로 시공자를 직접 고르는 반셀프 인테리어 매칭.</p>
      <p>
        <strong>스캐폴딩 단계입니다.</strong> 화면은 <code>design/</code>의 시안을 기준으로 P4에서
        구현합니다.
      </p>
      <h2>공종 {WORK_CATEGORY_SEEDS.length}종 (정본)</h2>
      <ul>
        {WORK_CATEGORY_SEEDS.map((category) => (
          <li key={category.code}>
            {category.nameKo} <code>{category.code}</code>
          </li>
        ))}
      </ul>
    </main>
  );
}
