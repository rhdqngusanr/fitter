/**
 * 볼 수 없는 시공 사례.
 *
 * **시안(C-05)의 "삭제된 항목" 상태가 요구한 것을 여기서 한다** — "링크가 SEO로 남아
 * 있으므로 404 대신 설명 화면을 준다." 검색 결과나 공유 링크로 들어온 사람을
 * 빈 404로 돌려보내면 그 사람은 서비스가 죽었다고 판단한다.
 *
 * 다만 **이유를 구분해 알려주지는 않는다.** 없는 주소·비공개 항목·승인이 취소된
 * 시공자의 항목이 전부 같은 화면이다. 구분하면 "그 항목은 존재한다"가 새고,
 * 그건 비공개로 돌린 사람의 선택을 뒤집는 것이다.
 *
 * 그래서 문구가 "내려갔습니다"가 아니라 "볼 수 없습니다"다 — 어느 경우에도 참인 말이다.
 */
export default function PortfolioNotFound() {
  return (
    <main
      className="shell"
      style={{ paddingTop: 'var(--space-16)', paddingBottom: 'var(--space-16)' }}
    >
      <div className="empty gallery-empty">
        <span className="empty__icon" aria-hidden="true" />
        <strong className="gallery-empty__title">이 시공 사례는 볼 수 없습니다</strong>
        <span className="gallery-empty__body">
          시공자가 내렸거나 주소가 바뀌었을 수 있습니다. 다른 시공 사진은 계속 볼 수 있습니다.
        </span>
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            marginTop: 6,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <a href="/requests/new" className="btn btn--secondary btn--lg">
            의뢰 등록하기
          </a>
          <a href="/gallery" className="btn btn--primary btn--lg">
            비슷한 사진 보기
          </a>
        </div>
      </div>
    </main>
  );
}
